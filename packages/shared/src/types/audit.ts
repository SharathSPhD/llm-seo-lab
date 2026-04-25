export type EvidenceTier = "tier1" | "tier2" | "tier3";

export type AeoTactic =
  | "cite_sources"
  | "quotation_addition"
  | "statistics_addition"
  | "authoritative_tone"
  | "schema_coverage"
  | "internal_link_injection"
  | "freshness";

export interface AuditScores {
  cite_sources: number;
  quotation_addition: number;
  statistics_addition: number;
  authoritative_tone: number;
  schema_coverage: number;
}

export interface AuditGap {
  gap_id: string;
  tactic: AeoTactic;
  predicted_lift_pp: number;
  evidence_tier: EvidenceTier;
  geo_paper_reference: string;
  page_locator: string;
  rationale: string;
}

export interface PageAuditResult {
  page_url: string;
  audit_id: string;
  timestamp: string;
  claude_model: string;
  scores: AuditScores;
  gaps: AuditGap[];
}

export interface SiteAuditSummary {
  audit_run_id: string;
  timestamp: string;
  pages_audited: number;
  total_gaps: number;
  top_tactics: { tactic: AeoTactic; count: number; aggregate_lift_pp: number }[];
  predicted_aggregate_lift_pp: number;
}
