/**
 * @llm-seo-lab/state — driver-layer types.
 *
 * Re-export the row shapes from @llm-seo-lab/shared so callers can
 * `import { UseCaseRow, ... } from "@llm-seo-lab/state"` without also
 * pulling shared in directly. Add the v0.4.0-only `PendingActionRow`
 * here.
 */

import type { Stage } from "@llm-seo-lab/shared";

export type {
  Stage,
  Substrate,
  UseCaseRow,
  UseCaseEventRow,
  RecommendationRow,
  ApplicationRow,
  MeasurementRow,
  AnalysisRow,
  UseCaseStateBundle,
} from "@llm-seo-lab/shared";

export interface PendingActionRow {
  id: string;
  use_case_id: string;
  requested_stage: Stage;
  requested_by: string;
  requested_at: string;
  status: "pending" | "executed" | "failed";
  executed_at: string | null;
  result: Record<string, unknown> | null;
}

export interface CreateUseCaseInput {
  user_id: string;
  url: string;
  substrate: "web" | "substack" | "youtube";
  title: string;
  topic: string;
  target_audience: string | null;
  notes: string | null;
}

export interface UpdateUseCaseStageInput {
  use_case_id: string;
  user_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  iteration: number;
  payload?: Record<string, unknown>;
}

export interface EnqueuePendingActionInput {
  use_case_id: string;
  requested_stage: Stage;
  requested_by: string;
}
