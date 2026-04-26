/**
 * @llm-seo-lab/state — driver interface.
 *
 * The single persistence abstraction used by both the MCP server (local
 * `JsonlSqliteDriver`) and the Cloudflare Pages app (`D1HttpDriver`).
 * Adding a new driver means implementing this interface; the MCP tools
 * and the Next.js server actions never touch a database directly.
 *
 * Spec: docs/v0.4.0/spec.md §2.
 *
 * Ownership invariant. Every driver method that mutates a child table
 * (recommendations / applications / measurements / analyses /
 * use_case_events / pending_actions) MUST verify that
 * `row.user_id === use_cases.user_id` for the parent `use_case_id`
 * BEFORE issuing any SQL. Violations throw `UseCaseOwnershipError`.
 *
 * State transitions. `updateUseCaseStage` MUST reject illegal
 * transitions (per `isLegalTransition` in @llm-seo-lab/shared) with
 * `IllegalTransitionError` BEFORE any SQL. The spec's transition table
 * is the single source of truth.
 */

import type {
  AnalysisRow,
  ApplicationRow,
  CreateUseCaseInput,
  EnqueuePendingActionInput,
  MeasurementRow,
  PendingActionRow,
  RecommendationRow,
  Stage,
  UpdateUseCaseStageInput,
  UseCaseEventRow,
  UseCaseRow,
  UseCaseStateBundle,
} from "./types.ts";

export interface StateDriver {
  listUseCases(user_id: string): Promise<UseCaseRow[]>;
  getUseCase(use_case_id: string): Promise<UseCaseRow | null>;
  getUseCaseBundle(use_case_id: string): Promise<UseCaseStateBundle>;
  readPendingActions(opts: {
    use_case_id?: string;
    user_id: string;
  }): Promise<PendingActionRow[]>;

  createUseCase(input: CreateUseCaseInput): Promise<UseCaseRow>;
  updateUseCaseStage(input: UpdateUseCaseStageInput): Promise<UseCaseEventRow>;

  insertRecommendations(
    rows: Omit<RecommendationRow, "id" | "created_at">[],
  ): Promise<RecommendationRow[]>;
  insertApplication(
    row: Omit<ApplicationRow, "id" | "applied_at">,
  ): Promise<ApplicationRow>;
  insertMeasurement(
    row: Omit<MeasurementRow, "id" | "observed_at">,
  ): Promise<MeasurementRow>;
  insertAnalysis(
    row: Omit<AnalysisRow, "id" | "created_at">,
  ): Promise<AnalysisRow>;

  enqueuePendingAction(input: EnqueuePendingActionInput): Promise<PendingActionRow>;
  markActionExecuted(opts: {
    action_id: string;
    result: Record<string, unknown>;
    status?: "executed" | "failed";
  }): Promise<PendingActionRow>;

  close(): void | Promise<void>;
}

export type StageList = readonly Stage[];
