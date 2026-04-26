/**
 * v0.3.0 citation-pull row types.
 *
 * These mirror the columns in `infra/supabase/migrations/0001_init.sql` so a
 * single payload can travel from the dashboard (`apps/web`) through MCP
 * (`mcp/src/tools/v030.ts`) into the substrate adapters
 * (`plugin/scripts/adapters/`) and back without translation. Keep this in
 * sync with the migration: the migration is the source of truth, this file
 * is the structural mirror.
 *
 * Why here, not in mcp/: both the substrate adapters and the dashboard need
 * these types, and neither is allowed to import from `mcp/src/...`. Putting
 * them in `@llm-seo-lab/shared` keeps the dependency arrows pointing one
 * way (mcp -> shared, plugin -> shared, apps/web -> shared).
 */

export type Stage =
  | "DRAFT"
  | "RECOMMENDED"
  | "APPLIED"
  | "REPUBLISHED"
  | "MEASURING"
  | "MEASURED"
  | "ANALYZED"
  | "ABANDONED";

export type Substrate = "web" | "substack" | "youtube";

export type ArtifactKind =
  | "pr_diff"
  | "paste_markdown"
  | "paste_html"
  | "youtube_checklist";

/** Charter principle keys ratified in docs/decisions/2026-04-26-citation-pull-charter.md. */
export type CharterPrinciple =
  | "atomic-snippet-density"
  | "semantic-anchor-stability"
  | "q-shaped-subhead-lattice"
  | "cross-engine-intermediary"
  | "inverted-retrieval-target";

export const CHARTER_PRINCIPLE_LIST: CharterPrinciple[] = [
  "atomic-snippet-density",
  "semantic-anchor-stability",
  "q-shaped-subhead-lattice",
  "cross-engine-intermediary",
  "inverted-retrieval-target",
];

/** Negative-principle guard from R2 charter (Buddhi gate G1). */
export const FORBIDDEN_PRINCIPLES = [
  "link-building",
  "sitemap-firehose",
  "indexnow-ping-campaign",
  "directory-submission",
] as const;

// ---------------------------------------------------------------------------
// Row types (one per Supabase table)
// ---------------------------------------------------------------------------

export interface UseCaseRow {
  id: string;
  user_id: string;
  url: string;
  substrate: Substrate;
  title: string;
  topic: string;
  target_audience: string | null;
  current_stage: Stage;
  current_iteration: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseCaseEventRow {
  id: string;
  use_case_id: string;
  user_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  iteration: number;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface RecommendationRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  triz_principle: string;
  applicability_score: number;
  knob: string;
  diff_summary: string;
  payload: Record<string, unknown>;
  rationale: string;
  expected_engines: string[];
  claude_run_id: string | null;
  created_at: string;
}

export interface ApplicationRow {
  id: string;
  use_case_id: string;
  recommendation_id: string;
  user_id: string;
  iteration: number;
  artifact_kind: string;
  artifact_summary: string;
  applied_at: string;
}

export interface MeasurementRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  engine: string;
  prompt: string;
  observed_answer: string;
  citation_present: boolean;
  citation_position: number | null;
  source_authority: string | null;
  notes: string | null;
  screenshot_path: string | null;
  observed_at: string;
}

export interface AnalysisRow {
  id: string;
  use_case_id: string;
  user_id: string;
  iteration: number;
  verdict: "improved" | "stable" | "regressed" | "inconclusive" | "stub";
  per_engine_delta: Record<string, unknown> | null;
  attractor_metrics: Record<string, unknown> | null;
  triz_principles_cited: string[] | null;
  next_iteration_suggestion: string | null;
  claude_run_id: string | null;
  created_at: string;
}

export interface UseCaseStateBundle {
  use_case: UseCaseRow;
  events: UseCaseEventRow[];
  recommendations: RecommendationRow[];
  applications: ApplicationRow[];
  measurements: MeasurementRow[];
  analyses: AnalysisRow[];
}

export interface ArtifactPayload {
  recommendation_id: string;
  artifact_kind: ArtifactKind;
  primary: string;
  ancillary?: Record<string, string>;
  human_steps: string[];
}

// ---------------------------------------------------------------------------
// Adapter contract (Substrate Adapter Pattern, R4)
// ---------------------------------------------------------------------------

/**
 * What the adapter sees of a use case when it produces a recommendation.
 * We pass a narrow projection so the adapter never has to think about the
 * dashboard's auth/state plumbing.
 */
export interface AdapterUseCase {
  id: string;
  url: string;
  substrate: Substrate;
  title: string;
  topic: string;
  target_audience: string | null;
  iteration: number;
}

/**
 * Adapter output for a single (principle × use_case) pair, before MCP
 * stamps it with `id`, `created_at`, `claude_run_id`, etc. and inserts it
 * into Supabase. This is also what the substrate-side TRIZ + Pratyakṣa
 * loop returns when it has a Claude-derived payload.
 */
export interface RecommendationDraft {
  triz_principle: CharterPrinciple;
  applicability_score: number;
  knob: string;
  diff_summary: string;
  payload: Record<string, unknown>;
  rationale: string;
  expected_engines: string[];
  /** Per-adapter voice profile (R2 P6 — consumed, not first-class). */
  voice_profile: string;
}

/**
 * Substrate adapter contract — what `pull_recommend` and
 * `pull_apply_artifact` consume.
 *
 *   - `recommend()` MUST return one draft per charter principle (no more,
 *     no less). Buddhi gate G1 enforces this at the MCP layer.
 *   - `applyArtifact()` MUST produce an artifact whose `artifact_kind`
 *     matches the substrate (web→pr_diff, substack→paste_markdown,
 *     youtube→youtube_checklist).
 *   - Adapters MUST NOT call Supabase, the dashboard, or any external
 *     network. They are pure functions of (use case, principle).
 */
export interface SubstrateAdapter {
  substrate: Substrate;
  /** R2 P6 voice profile (per-adapter constant). */
  voiceProfile: string;
  recommend(uc: AdapterUseCase, principle: CharterPrinciple): RecommendationDraft;
  applyArtifact(rec: RecommendationRow, uc: AdapterUseCase): ArtifactPayload;
}

// ---------------------------------------------------------------------------
// Stage-machine validation (spec §3.2)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<Stage, Stage[]> = {
  DRAFT: ["RECOMMENDED", "ABANDONED"],
  RECOMMENDED: ["APPLIED", "ABANDONED"],
  APPLIED: ["REPUBLISHED", "ABANDONED"],
  REPUBLISHED: ["MEASURING", "ABANDONED"],
  MEASURING: ["MEASURED", "ABANDONED"],
  MEASURED: ["ANALYZED", "ABANDONED"],
  ANALYZED: ["RECOMMENDED", "ABANDONED"],
  ABANDONED: [],
};

export function isLegalTransition(from: Stage, to: Stage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: Stage): Stage[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
