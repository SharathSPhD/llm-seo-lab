/**
 * D1HttpDriver — Cloudflare D1 state driver.
 *
 * Talks to a D1 database via the standard D1 binding (`D1Database`).
 * Cloudflare Pages Functions and Workers receive a `LLM_SEO_LAB_DB`
 * binding that conforms to {@link D1Like}. Tests can pass a fake
 * implementation that mirrors the same surface.
 *
 * Spec: docs/v0.4.0/spec.md §2, §6.
 *
 * Symmetry with `JsonlSqliteDriver`:
 *   - Same SQL strings (from `sql/sqlite-sql.ts`) — D1 is SQLite under
 *     the hood.
 *   - Same row-mapper helpers, so JSON columns deserialize identically.
 *   - Hosted environment does NOT mirror writes to JSONL files; the
 *     local plugin does that via `/pull:sync` after pulling pending
 *     actions and replaying them locally.
 *
 * Ownership invariant. Identical to JsonlSqliteDriver.
 */

import { isLegalTransition } from "@llm-seo-lab/shared";
import type { StateDriver } from "../driver.ts";
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

/**
 * Subset of the Cloudflare D1Database surface the driver actually uses.
 * Mirrors @cloudflare/workers-types but kept narrow so we don't pull
 * the full Workers types into shared/state code.
 */
export interface D1Like {
  prepare(sql: string): D1PreparedLike;
}

export interface D1PreparedLike {
  bind(...params: unknown[]): D1PreparedLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes?: number } }>;
}

export interface D1HttpDriverOptions {
  db: D1Like;
  newId?: () => string;
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

export class D1HttpDriver implements StateDriver {
  private readonly db: D1Like;
  private readonly newId: () => string;
  private readonly now: () => string;

  constructor(opts: D1HttpDriverOptions) {
    this.db = opts.db;
    this.newId = opts.newId ?? defaultNewId;
    this.now = opts.now ?? defaultNow;
  }

  // -------- read --------

  async listUseCases(user_id: string): Promise<UseCaseRow[]> {
    const r = await this.db
      .prepare(SQL.selectUseCasesByUser)
      .bind(user_id)
      .all<Record<string, unknown>>();
    return r.results.map(rowToUseCase);
  }

  async getUseCase(use_case_id: string): Promise<UseCaseRow | null> {
    const r = await this.db
      .prepare(SQL.selectUseCaseById)
      .bind(use_case_id)
      .first<Record<string, unknown>>();
    return r ? rowToUseCase(r) : null;
  }

  async getUseCaseBundle(use_case_id: string): Promise<UseCaseStateBundle> {
    const uc = await this.getUseCase(use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${use_case_id} not found`);
    const events = (
      await this.db
        .prepare(SQL.selectEventsByUseCase)
        .bind(use_case_id)
        .all<Record<string, unknown>>()
    ).results.map(rowToUseCaseEvent);
    const recommendations = (
      await this.db
        .prepare(SQL.selectRecommendationsByUseCase)
        .bind(use_case_id)
        .all<Record<string, unknown>>()
    ).results.map(rowToRecommendation);
    const applications = (
      await this.db
        .prepare(SQL.selectApplicationsByUseCase)
        .bind(use_case_id)
        .all<Record<string, unknown>>()
    ).results.map(rowToApplication);
    const measurements = (
      await this.db
        .prepare(SQL.selectMeasurementsByUseCase)
        .bind(use_case_id)
        .all<Record<string, unknown>>()
    ).results.map(rowToMeasurement);
    const analyses = (
      await this.db
        .prepare(SQL.selectAnalysesByUseCase)
        .bind(use_case_id)
        .all<Record<string, unknown>>()
    ).results.map(rowToAnalysis);
    return { use_case: uc, events, recommendations, applications, measurements, analyses };
  }

  async readPendingActions(opts: {
    use_case_id?: string;
    user_id: string;
  }): Promise<PendingActionRow[]> {
    const stmt = opts.use_case_id
      ? this.db
          .prepare(SQL.selectPendingActionsByUserAndUseCase)
          .bind(opts.user_id, opts.use_case_id)
      : this.db.prepare(SQL.selectPendingActionsByUser).bind(opts.user_id);
    const r = await stmt.all<Record<string, unknown>>();
    return r.results.map(rowToPendingAction);
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
    await this.db
      .prepare(SQL.insertUseCase)
      .bind(
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
      )
      .run();
    return row;
  }

  async updateUseCaseStage(input: UpdateUseCaseStageInput): Promise<UseCaseEventRow> {
    if (input.from_stage && !isLegalTransition(input.from_stage, input.to_stage)) {
      throw new IllegalTransitionError(
        `illegal_transition: ${input.from_stage} -> ${input.to_stage}`,
      );
    }
    const uc = await this.getUseCase(input.use_case_id);
    if (!uc) throw new UseCaseNotFoundError(`use case ${input.use_case_id} not found`);
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
    await this.db
      .prepare(SQL.insertUseCaseEvent)
      .bind(
        event.id,
        event.use_case_id,
        event.user_id,
        strOrNull(event.from_stage),
        event.to_stage,
        event.iteration,
        jsonOrNull(event.payload),
        event.created_at,
      )
      .run();
    await this.db
      .prepare(SQL.updateUseCaseStage)
      .bind(input.to_stage, input.iteration, ts, input.use_case_id)
      .run();
    return event;
  }

  // -------- write: children --------

  async insertRecommendations(
    rows: Omit<RecommendationRow, "id" | "created_at">[],
  ): Promise<RecommendationRow[]> {
    if (rows.length === 0) return [];
    const useCaseId = rows[0]!.use_case_id;
    const uc = await this.getUseCase(useCaseId);
    if (!uc) throw new UseCaseNotFoundError(`use case ${useCaseId} not found`);
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
    const out: RecommendationRow[] = [];
    for (const r of rows) {
      const id = this.newId();
      const ts = this.now();
      const inserted: RecommendationRow = { ...r, id, created_at: ts };
      await this.db
        .prepare(SQL.insertRecommendation)
        .bind(
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
        )
        .run();
      out.push(inserted);
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
    await this.db
      .prepare(SQL.insertApplication)
      .bind(
        inserted.id,
        inserted.use_case_id,
        inserted.recommendation_id,
        inserted.user_id,
        inserted.iteration,
        inserted.artifact_kind,
        inserted.artifact_summary,
        inserted.applied_at,
      )
      .run();
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
    await this.db
      .prepare(SQL.insertMeasurement)
      .bind(
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
      )
      .run();
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
    await this.db
      .prepare(SQL.insertAnalysis)
      .bind(
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
      )
      .run();
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
    await this.db
      .prepare(SQL.insertPendingAction)
      .bind(row.id, row.use_case_id, row.requested_stage, row.requested_by, row.requested_at)
      .run();
    return row;
  }

  async markActionExecuted(opts: {
    action_id: string;
    result: Record<string, unknown>;
    status?: "executed" | "failed";
  }): Promise<PendingActionRow> {
    const ts = this.now();
    const status = opts.status ?? "executed";
    const updated = await this.db
      .prepare(SQL.updatePendingActionExecuted)
      .bind(status, ts, JSON.stringify(opts.result), opts.action_id)
      .run();
    if ((updated.meta.changes ?? 0) === 0) {
      throw new StateDriverError(`pending action ${opts.action_id} not found`);
    }
    const row = await this.db
      .prepare(SQL.selectPendingActionById)
      .bind(opts.action_id)
      .first<Record<string, unknown>>();
    if (!row) throw new StateDriverError(`pending action ${opts.action_id} disappeared`);
    return rowToPendingAction(row);
  }

  close(): void {
    // D1 binding has no close hook; Cloudflare manages connection lifetime.
  }
}
