/**
 * JsonlSqliteDriver — local-first state driver.
 *
 * Persists every write to two places, in order:
 *
 *   1. Local SQLite (better-sqlite3 by default; any object that conforms
 *      to `SqliteLike` works for tests).
 *   2. The JSONL mirror at `data/use-cases/<id>/state.jsonl` via the
 *      pluggable `JsonlSink`.
 *
 * Reads come from SQLite. SQLite is the cache; JSONL is canonical.
 *
 * Spec: docs/v0.4.0/spec.md §2, §5.1.
 *
 * The driver is async-typed (returns `Promise<...>`) so callers can swap
 * in the `D1HttpDriver` without changing call sites, even though local
 * SQLite is synchronous under the hood.
 */

import type {
  AnalysisRow,
  ApplicationRow,
  CreateUseCaseInput,
  EnqueuePendingActionInput,
  MeasurementRow,
  PendingActionRow,
  RecommendationRow,
  UpdateUseCaseStageInput,
  UseCaseEventRow,
  UseCaseRow,
  UseCaseStateBundle,
} from "../types.ts";
import type { StateDriver } from "../driver.ts";
import { isLegalTransition } from "@llm-seo-lab/shared";
import {
  IllegalTransitionError,
  StateDriverError,
  UseCaseNotFoundError,
  UseCaseOwnershipError,
} from "../errors.ts";
import { SQL } from "../sql/sqlite-sql.ts";
import {
  rowToAnalysis,
  rowToApplication,
  rowToMeasurement,
  rowToPendingAction,
  rowToRecommendation,
  rowToUseCase,
  rowToUseCaseEvent,
} from "../sql/row-mapper.ts";
import type { JsonlSink } from "../jsonl.ts";

/**
 * Minimum surface we need from a SQLite client. `better-sqlite3`'s
 * `Database` class fits this exactly; tests can hand-roll a simple
 * in-memory implementation that proxies to the same API.
 */
export interface SqliteLike {
  prepare(sql: string): SqliteStmt;
  exec(sql: string): unknown;
  close?(): void;
}

export interface SqliteStmt {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface JsonlSqliteDriverOptions {
  db: SqliteLike;
  sink: JsonlSink;
  /** RFC4122 v4 generator. Defaults to crypto.randomUUID. */
  newId?: () => string;
  /** Wall-clock for timestamps. Defaults to () => new Date().toISOString(). */
  now?: () => string;
}

function defaultNewId(): string {
  return globalThis.crypto.randomUUID();
}

function defaultNow(): string {
  return new Date().toISOString();
}

function strOrNull(v: string | null | undefined): string | null {
  return v ?? null;
}

function jsonOrNull(v: unknown): string | null {
  if (v == null) return null;
  return JSON.stringify(v);
}

export class JsonlSqliteDriver implements StateDriver {
  private readonly db: SqliteLike;
  private readonly sink: JsonlSink;
  private readonly newId: () => string;
  private readonly now: () => string;

  constructor(opts: JsonlSqliteDriverOptions) {
    this.db = opts.db;
    this.sink = opts.sink;
    this.newId = opts.newId ?? defaultNewId;
    this.now = opts.now ?? defaultNow;
  }

  // -------- read --------

  async listUseCases(user_id: string): Promise<UseCaseRow[]> {
    const stmt = this.db.prepare(SQL.selectUseCasesByUser);
    const rows = stmt.all(user_id) as Record<string, unknown>[];
    return rows.map(rowToUseCase);
  }

  async getUseCase(use_case_id: string): Promise<UseCaseRow | null> {
    const stmt = this.db.prepare(SQL.selectUseCaseById);
    const row = stmt.get(use_case_id) as Record<string, unknown> | undefined;
    return row ? rowToUseCase(row) : null;
  }

  async getUseCaseBundle(use_case_id: string): Promise<UseCaseStateBundle> {
    const uc = await this.getUseCase(use_case_id);
    if (!uc) {
      throw new UseCaseNotFoundError(`use case ${use_case_id} not found`);
    }
    const events = (
      this.db.prepare(SQL.selectEventsByUseCase).all(use_case_id) as Record<string, unknown>[]
    ).map(rowToUseCaseEvent);
    const recommendations = (
      this.db.prepare(SQL.selectRecommendationsByUseCase).all(use_case_id) as Record<string, unknown>[]
    ).map(rowToRecommendation);
    const applications = (
      this.db.prepare(SQL.selectApplicationsByUseCase).all(use_case_id) as Record<string, unknown>[]
    ).map(rowToApplication);
    const measurements = (
      this.db.prepare(SQL.selectMeasurementsByUseCase).all(use_case_id) as Record<string, unknown>[]
    ).map(rowToMeasurement);
    const analyses = (
      this.db.prepare(SQL.selectAnalysesByUseCase).all(use_case_id) as Record<string, unknown>[]
    ).map(rowToAnalysis);
    return { use_case: uc, events, recommendations, applications, measurements, analyses };
  }

  async readPendingActions(opts: {
    use_case_id?: string;
    user_id: string;
  }): Promise<PendingActionRow[]> {
    const stmt = opts.use_case_id
      ? this.db.prepare(SQL.selectPendingActionsByUserAndUseCase)
      : this.db.prepare(SQL.selectPendingActionsByUser);
    const rows = (
      opts.use_case_id
        ? stmt.all(opts.user_id, opts.use_case_id)
        : stmt.all(opts.user_id)
    ) as Record<string, unknown>[];
    return rows.map(rowToPendingAction);
  }

  // -------- write: use case --------

  async createUseCase(input: CreateUseCaseInput): Promise<UseCaseRow> {
    const id = this.newId();
    const ts = this.now();
    const row: UseCaseRow = {
      id,
      user_id: input.user_id,
      url: input.url,
      substrate: input.substrate,
      title: input.title,
      topic: input.topic,
      target_audience: input.target_audience,
      current_stage: "DRAFT",
      current_iteration: 0,
      notes: input.notes,
      created_at: ts,
      updated_at: ts,
    };
    this.db
      .prepare(SQL.insertUseCase)
      .run(
        row.id,
        row.user_id,
        row.url,
        row.substrate,
        row.title,
        row.topic,
        strOrNull(row.target_audience),
        row.current_stage,
        row.current_iteration,
        strOrNull(row.notes),
        row.created_at,
        row.updated_at,
      );
    await this.sink.append(row.id, { type: "USE_CASE_CREATED", use_case: row });
    return row;
  }

  async updateUseCaseStage(input: UpdateUseCaseStageInput): Promise<UseCaseEventRow> {
    if (input.from_stage && !isLegalTransition(input.from_stage, input.to_stage)) {
      throw new IllegalTransitionError(
        `illegal_transition: ${input.from_stage} -> ${input.to_stage}`,
      );
    }
    const uc = await this.getUseCase(input.use_case_id);
    if (!uc) {
      throw new UseCaseNotFoundError(`use case ${input.use_case_id} not found`);
    }
    if (uc.user_id !== input.user_id) {
      throw new UseCaseOwnershipError(
        `user_id ${input.user_id} does not own use_case ${input.use_case_id}`,
      );
    }
    const id = this.newId();
    const ts = this.now();
    const event: UseCaseEventRow = {
      id,
      use_case_id: input.use_case_id,
      user_id: input.user_id,
      from_stage: input.from_stage,
      to_stage: input.to_stage,
      iteration: input.iteration,
      payload: input.payload ?? null,
      created_at: ts,
    };
    this.db
      .prepare(SQL.insertUseCaseEvent)
      .run(
        event.id,
        event.use_case_id,
        event.user_id,
        strOrNull(event.from_stage),
        event.to_stage,
        event.iteration,
        jsonOrNull(event.payload),
        event.created_at,
      );
    this.db
      .prepare(SQL.updateUseCaseStage)
      .run(input.to_stage, input.iteration, ts, input.use_case_id);
    await this.sink.append(input.use_case_id, { type: "STAGE_TRANSITION", event });
    return event;
  }

  // -------- write: children --------

  async insertRecommendations(
    rows: Omit<RecommendationRow, "id" | "created_at">[],
  ): Promise<RecommendationRow[]> {
    if (rows.length === 0) return [];
    const useCaseId = rows[0]!.use_case_id;
    const uc = await this.getUseCase(useCaseId);
    if (!uc) {
      throw new UseCaseNotFoundError(`use case ${useCaseId} not found`);
    }
    for (const r of rows) {
      if (r.use_case_id !== useCaseId) {
        throw new StateDriverError(
          "insertRecommendations rows must share a single use_case_id",
        );
      }
      if (r.user_id !== uc.user_id) {
        throw new UseCaseOwnershipError(
          `recommendation user_id ${r.user_id} does not match use case owner ${uc.user_id}`,
        );
      }
    }
    const stmt = this.db.prepare(SQL.insertRecommendation);
    const out: RecommendationRow[] = [];
    for (const r of rows) {
      const id = this.newId();
      const ts = this.now();
      const inserted: RecommendationRow = { ...r, id, created_at: ts };
      stmt.run(
        inserted.id,
        inserted.use_case_id,
        inserted.user_id,
        inserted.iteration,
        inserted.triz_principle,
        inserted.applicability_score,
        inserted.knob,
        inserted.diff_summary,
        JSON.stringify(inserted.payload),
        inserted.rationale,
        JSON.stringify(inserted.expected_engines),
        strOrNull(inserted.claude_run_id),
        inserted.created_at,
      );
      out.push(inserted);
      await this.sink.append(inserted.use_case_id, {
        type: "RECOMMENDATION_CREATED",
        recommendation: inserted,
      });
    }
    return out;
  }

  async insertApplication(
    row: Omit<ApplicationRow, "id" | "applied_at">,
  ): Promise<ApplicationRow> {
    const uc = await this.getUseCase(row.use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${row.use_case_id} not found`);
    if (row.user_id !== uc.user_id) {
      throw new UseCaseOwnershipError(
        `application user_id ${row.user_id} does not match use case owner ${uc.user_id}`,
      );
    }
    const id = this.newId();
    const ts = this.now();
    const inserted: ApplicationRow = { ...row, id, applied_at: ts };
    this.db
      .prepare(SQL.insertApplication)
      .run(
        inserted.id,
        inserted.use_case_id,
        inserted.recommendation_id,
        inserted.user_id,
        inserted.iteration,
        inserted.artifact_kind,
        inserted.artifact_summary,
        inserted.applied_at,
      );
    await this.sink.append(inserted.use_case_id, {
      type: "APPLICATION_CREATED",
      application: inserted,
    });
    return inserted;
  }

  async insertMeasurement(
    row: Omit<MeasurementRow, "id" | "observed_at">,
  ): Promise<MeasurementRow> {
    const uc = await this.getUseCase(row.use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${row.use_case_id} not found`);
    if (row.user_id !== uc.user_id) {
      throw new UseCaseOwnershipError(
        `measurement user_id ${row.user_id} does not match use case owner ${uc.user_id}`,
      );
    }
    const id = this.newId();
    const ts = this.now();
    const inserted: MeasurementRow = { ...row, id, observed_at: ts };
    this.db
      .prepare(SQL.insertMeasurement)
      .run(
        inserted.id,
        inserted.use_case_id,
        inserted.user_id,
        inserted.iteration,
        inserted.engine,
        inserted.prompt,
        inserted.observed_answer,
        inserted.citation_present ? 1 : 0,
        inserted.citation_position,
        strOrNull(inserted.source_authority),
        strOrNull(inserted.notes),
        strOrNull(inserted.screenshot_path),
        inserted.observed_at,
      );
    await this.sink.append(inserted.use_case_id, {
      type: "MEASUREMENT_CREATED",
      measurement: inserted,
    });
    return inserted;
  }

  async insertAnalysis(
    row: Omit<AnalysisRow, "id" | "created_at">,
  ): Promise<AnalysisRow> {
    const uc = await this.getUseCase(row.use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${row.use_case_id} not found`);
    if (row.user_id !== uc.user_id) {
      throw new UseCaseOwnershipError(
        `analysis user_id ${row.user_id} does not match use case owner ${uc.user_id}`,
      );
    }
    const id = this.newId();
    const ts = this.now();
    const inserted: AnalysisRow = { ...row, id, created_at: ts };
    this.db
      .prepare(SQL.insertAnalysis)
      .run(
        inserted.id,
        inserted.use_case_id,
        inserted.user_id,
        inserted.iteration,
        inserted.verdict,
        jsonOrNull(inserted.per_engine_delta),
        jsonOrNull(inserted.attractor_metrics),
        jsonOrNull(inserted.triz_principles_cited),
        strOrNull(inserted.next_iteration_suggestion),
        strOrNull(inserted.claude_run_id),
        inserted.created_at,
      );
    await this.sink.append(inserted.use_case_id, {
      type: "ANALYSIS_CREATED",
      analysis: inserted,
    });
    return inserted;
  }

  // -------- intent queue --------

  async enqueuePendingAction(
    input: EnqueuePendingActionInput,
  ): Promise<PendingActionRow> {
    const uc = await this.getUseCase(input.use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${input.use_case_id} not found`);
    if (input.requested_by !== uc.user_id) {
      throw new UseCaseOwnershipError(
        `requested_by ${input.requested_by} does not own use_case ${input.use_case_id}`,
      );
    }
    const id = this.newId();
    const ts = this.now();
    const row: PendingActionRow = {
      id,
      use_case_id: input.use_case_id,
      requested_stage: input.requested_stage,
      requested_by: input.requested_by,
      requested_at: ts,
      status: "pending",
      executed_at: null,
      result: null,
    };
    this.db
      .prepare(SQL.insertPendingAction)
      .run(row.id, row.use_case_id, row.requested_stage, row.requested_by, row.requested_at);
    return row;
  }

  async markActionExecuted(opts: {
    action_id: string;
    result: Record<string, unknown>;
    status?: "executed" | "failed";
  }): Promise<PendingActionRow> {
    const ts = this.now();
    const status = opts.status ?? "executed";
    const updated = this.db
      .prepare(SQL.updatePendingActionExecuted)
      .run(status, ts, JSON.stringify(opts.result), opts.action_id);
    if (updated.changes === 0) {
      throw new StateDriverError(`pending action ${opts.action_id} not found`);
    }
    const row = this.db.prepare(SQL.selectPendingActionById).get(opts.action_id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new StateDriverError(`pending action ${opts.action_id} disappeared`);
    return rowToPendingAction(row);
  }

  close(): void {
    this.db.close?.();
  }
}
