import type { AeoTactic, EvidenceTier } from "./audit.ts";

export interface MeasurementSchedule {
  pre_merge_at: string;
  post_merge_t_plus_1d: string | null;
  post_merge_t_plus_7d: string | null;
  post_merge_t_plus_14d: string | null;
}

export interface ContentBrief {
  brief_id: string;
  gap_id: string;
  page_url: string;
  tactic: AeoTactic;
  evidence_tier: EvidenceTier;
  rationale_md: string;
  diff_patch: string;
  revert_plan_md: string;
  measurement_plan: MeasurementSchedule;
  emitted_schema_blocks?: string[];
  created_at: string;
  claude_model: string;
}
