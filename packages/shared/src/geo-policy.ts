import type { AeoTactic, EvidenceTier } from "./types/audit.ts";

/**
 * GEO-paper evidence policy. Source: KDD 2024 GEO paper §4.2.
 * Tier-1 tactics have empirical 30-40% relative impression lift on
 * position-adjusted word count. Tier-2 tactics are weakly supported.
 * Keyword stuffing is explicitly NOT in the tactic list (the GEO paper
 * shows it HURTS Perplexity by 10%).
 */
export const TACTIC_TIER: Record<AeoTactic, EvidenceTier> = {
  cite_sources: "tier1",
  quotation_addition: "tier1",
  statistics_addition: "tier1",
  authoritative_tone: "tier2",
  schema_coverage: "tier2",
  internal_link_injection: "tier2",
  freshness: "tier2",
};

export const TACTIC_REFERENCE: Record<AeoTactic, string> = {
  cite_sources: "KDD 2024 GEO paper §4.2 (Cite Sources, +30-40% relative lift)",
  quotation_addition: "KDD 2024 GEO paper §4.2 (Quotation Addition, +30-40% relative lift)",
  statistics_addition: "KDD 2024 GEO paper §4.2 (Statistics Addition, +30-40% relative lift)",
  authoritative_tone: "KDD 2024 GEO paper §4.3 (weak support across engines)",
  schema_coverage: "schema.org structured data; per Phase 1 citation-mechanisms.md",
  internal_link_injection: "Phase 1 evidence-base; weakly supported",
  freshness: "Phase 1 evidence-base; >3-month decay observed",
};

export function rankTacticByEvidence(a: AeoTactic, b: AeoTactic): number {
  const order: EvidenceTier[] = ["tier1", "tier2", "tier3"];
  return order.indexOf(TACTIC_TIER[a]) - order.indexOf(TACTIC_TIER[b]);
}
