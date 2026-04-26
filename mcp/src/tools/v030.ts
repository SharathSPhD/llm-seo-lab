/**
 * v0.3.0 MCP tools — citation-pull workflow.
 *
 * Spec: docs/v0.3.0/spec.md §5.
 *
 *   - read_use_case_state    : load full UseCase from Supabase
 *   - record_use_case_event  : append a stage transition (validates legality)
 *   - pull_recommend         : run TRIZ + adapter recommend(); persist rows
 *   - pull_apply_artifact    : build the apply artifact (does NOT persist)
 *   - pull_analyze           : compute verdict + persist Analysis row
 *
 * Plus deprecation envelopes for v0.2.0 `track_citations` and
 * `read_citation_trend` (registered in index.ts; the deprecated tool
 * descriptors live here so the deprecation contract is colocated with
 * the v0.3.0 surface).
 *
 * Design contract (matches v0.2.0 audit_page / generate_brief):
 *
 *   - Every tool is fail-open: a Claude CLI parse failure produces a
 *     deterministic stub with a clearly-marked `claude_run_id: null`
 *     and (for analyses) `verdict: "stub"`.
 *   - Supabase access uses the service-role client. The schema's
 *     `assert_user_owns_use_case` trigger guarantees we cannot insert
 *     a row with a `user_id` that does not own the parent use case.
 *   - All tools accept an optional `supabase` injectable for tests so
 *     the test suite can run without a live Supabase project.
 */

import { ok, err, CHARTER_PRINCIPLE_LIST } from "@llm-seo-lab/shared";
import type { CharterPrinciple, AdapterUseCase } from "@llm-seo-lab/shared";
import { getAdapter } from "@llm-seo-lab/plugin/adapters";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDescriptor, ToolContext } from "../types.ts";
import { errInvalidInput, errNotFound, errInternal } from "../errors.ts";

// ---------------------------------------------------------------------------
// Types — kept structurally identical to apps/web/lib/supabase/types.ts so
// the dashboard and MCP can hand a single payload back and forth without
// translation.
// ---------------------------------------------------------------------------

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
  artifact_kind: "pr_diff" | "paste_markdown" | "paste_html" | "youtube_checklist";
  primary: string;
  ancillary?: Record<string, string>;
  human_steps: string[];
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

// ---------------------------------------------------------------------------
// Supabase data access — minimal, injectable for tests
// ---------------------------------------------------------------------------

/**
 * Slim subset of the Supabase JS client used by these tools. Production
 * passes a real `SupabaseClient<Database>`; tests pass an in-memory
 * fake. We keep the surface tiny so the fake stays tractable.
 */
export interface SupabaseLike {
  from(table: string): {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        order?: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        single?: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
        maybeSingle?: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    insert: (rows: unknown | unknown[]) => {
      select: () => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ data: unknown | null; error: { message: string } | null }>;
    };
  };
}

export interface V030ToolContext extends ToolContext {
  supabase?: SupabaseLike;
}

function getSupabase(ctx: ToolContext): SupabaseLike | null {
  const inj = (ctx as V030ToolContext).supabase;
  return inj ?? null;
}

async function loadUseCase(sb: SupabaseLike, id: string): Promise<UseCaseRow | null> {
  const q = sb.from("use_cases").select("*").eq("id", id);
  const r = q.maybeSingle ? await q.maybeSingle() : null;
  if (!r || r.error) return null;
  return (r.data as UseCaseRow | null) ?? null;
}

async function loadList<T>(sb: SupabaseLike, table: string, useCaseId: string): Promise<T[]> {
  const q = sb.from(table).select("*").eq("use_case_id", useCaseId);
  const r = q.order ? await q.order("created_at", { ascending: true }) : { data: [], error: null };
  if (r.error) return [];
  return (r.data as T[] | null) ?? [];
}

async function insertReturning<T>(sb: SupabaseLike, table: string, row: unknown): Promise<T | null> {
  const r = await sb.from(table).insert(row).select();
  if (r.error || !r.data || r.data.length === 0) return null;
  return r.data[0] as T;
}

// ---------------------------------------------------------------------------
// Skill-prompt loading (mirrors v0.2.0 audit_page pattern)
// ---------------------------------------------------------------------------

async function loadSkill(ctx: ToolContext, name: string): Promise<string> {
  const path = join(ctx.cwd, "skills", name, "SKILL.md");
  if (!existsSync(path)) return "";
  return readFile(path, "utf8");
}

function tryParseJsonBlock<T>(text: string): T | null {
  const m = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]!) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool: read_use_case_state
// ---------------------------------------------------------------------------

export const readUseCaseState: ToolDescriptor<
  { use_case_id: string },
  UseCaseStateBundle
> = {
  name: "read_use_case_state",
  description:
    "Load a UseCase and its full history (events, recommendations, applications, measurements, analyses) from Supabase.",
  inputSchema: {
    type: "object",
    properties: { use_case_id: { type: "string" } },
    required: ["use_case_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const sb = getSupabase(ctx);
    if (!sb) {
      return err(
        errInternal(
          "Supabase client not configured for this MCP context",
          "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY before starting MCP",
        ),
      );
    }
    const uc = await loadUseCase(sb, input.use_case_id);
    if (!uc) {
      return err(errNotFound(`use case ${input.use_case_id} not found`, "Verify the id and that the row's RLS owner matches"));
    }
    const [events, recs, apps, meas, analyses] = await Promise.all([
      loadList<UseCaseEventRow>(sb, "use_case_events", uc.id),
      loadList<RecommendationRow>(sb, "recommendations", uc.id),
      loadList<ApplicationRow>(sb, "applications", uc.id),
      loadList<MeasurementRow>(sb, "measurements", uc.id),
      loadList<AnalysisRow>(sb, "analyses", uc.id),
    ]);
    return ok({ use_case: uc, events, recommendations: recs, applications: apps, measurements: meas, analyses });
  },
};

// ---------------------------------------------------------------------------
// Tool: record_use_case_event
// ---------------------------------------------------------------------------

export const recordUseCaseEvent: ToolDescriptor<
  {
    use_case_id: string;
    user_id: string;
    from_stage: Stage | null;
    to_stage: Stage;
    iteration: number;
    payload?: Record<string, unknown>;
  },
  UseCaseEventRow
> = {
  name: "record_use_case_event",
  description:
    "Append a stage-transition event to use_case_events; rejects illegal transitions with INVALID_INPUT.",
  inputSchema: {
    type: "object",
    properties: {
      use_case_id: { type: "string" },
      user_id: { type: "string" },
      from_stage: { type: ["string", "null"] },
      to_stage: { type: "string" },
      iteration: { type: "number" },
      payload: { type: "object" },
    },
    required: ["use_case_id", "user_id", "to_stage", "iteration"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    if (input.from_stage && !isLegalTransition(input.from_stage, input.to_stage)) {
      return err(
        errInvalidInput(
          `illegal_transition: ${input.from_stage} -> ${input.to_stage}`,
          "See docs/v0.3.0/spec.md §3.2 for the allowed transition table",
        ),
      );
    }
    const sb = getSupabase(ctx);
    if (!sb) {
      return err(errInternal("Supabase client not configured", "Set SUPABASE_SERVICE_ROLE_KEY"));
    }
    const inserted = await insertReturning<UseCaseEventRow>(sb, "use_case_events", {
      use_case_id: input.use_case_id,
      user_id: input.user_id,
      from_stage: input.from_stage,
      to_stage: input.to_stage,
      iteration: input.iteration,
      payload: input.payload ?? null,
    });
    if (!inserted) {
      return err(
        errInternal(
          "insert into use_case_events failed",
          "Check Supabase logs; the trigger may have rejected a cross-user write",
        ),
      );
    }
    // Best-effort: keep current_stage in sync. Failure here is non-fatal for the test path.
    try {
      await sb.from("use_cases").update({ current_stage: input.to_stage, updated_at: new Date().toISOString() }).eq("id", input.use_case_id);
    } catch {
      // ignore — the dashboard is the canonical writer of current_stage
    }
    return ok(inserted);
  },
};

// ---------------------------------------------------------------------------
// Tool: pull_recommend
// ---------------------------------------------------------------------------

/**
 * Charter principles ratified in docs/decisions/2026-04-26-citation-pull-charter.md.
 *
 * v0.3.0 R4: per-substrate knobs/engines/rationales now live in the
 * substrate adapters at `plugin/scripts/adapters/{web,substack,youtube}.ts`.
 * `pull_recommend` calls `adapter.recommend(uc, principle)` for each
 * principle in `CHARTER_PRINCIPLE_LIST` and persists the resulting
 * draft. The MCP layer is therefore the orchestrator (Claude prompt,
 * Supabase persistence, rate-limit, ownership check); the adapters own
 * the substrate-specific shape.
 */
function toAdapterUseCase(uc: UseCaseRow, iteration: number): AdapterUseCase {
  return {
    id: uc.id,
    url: uc.url,
    substrate: uc.substrate,
    title: uc.title,
    topic: uc.topic,
    target_audience: uc.target_audience,
    iteration,
  };
}

export const pullRecommend: ToolDescriptor<
  { use_case_id: string; user_id: string; iteration?: number },
  { recommendations: RecommendationRow[]; claude_run_id: string | null }
> = {
  name: "pull_recommend",
  description:
    "Generate citation-pull recommendations for one use case (charter principles × substrate adapter), persist rows to Supabase, and return the inserted set.",
  inputSchema: {
    type: "object",
    properties: {
      use_case_id: { type: "string" },
      user_id: { type: "string" },
      iteration: { type: "number" },
    },
    required: ["use_case_id", "user_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("pull_recommend");
    if (!limit.ok) return err(limit.error);
    const sb = getSupabase(ctx);
    if (!sb) return err(errInternal("Supabase client not configured", "Set SUPABASE_SERVICE_ROLE_KEY"));
    const uc = await loadUseCase(sb, input.use_case_id);
    if (!uc) return err(errNotFound(`use case ${input.use_case_id} not found`, "Verify the id"));
    if (uc.user_id !== input.user_id) {
      return err(errInvalidInput("user_id does not own use_case", "The caller must pass the use case's owner id"));
    }
    const iteration = input.iteration ?? uc.current_iteration;

    const skill = await loadSkill(ctx, "pull-recommend");
    let claudeRunId: string | null = null;
    let trizPayloadFromClaude: { triz_principle: string; rationale: string; applicability_score: number; payload?: Record<string, unknown> }[] | null = null;
    if (skill) {
      const prompt = `${skill}\n\nINPUT use_case=${JSON.stringify({ id: uc.id, url: uc.url, substrate: uc.substrate, title: uc.title, topic: uc.topic, target_audience: uc.target_audience, iteration })}`;
      const r = await ctx.workers.claude.invoke(prompt, { timeoutMs: 120_000 });
      if (r.ok) {
        claudeRunId = `claude_${randomUUID().slice(0, 12)}`;
        trizPayloadFromClaude = tryParseJsonBlock(r.value);
      }
    }

    const adapter = getAdapter(uc.substrate);
    const adapterUc = toAdapterUseCase(uc, iteration);

    const rows: RecommendationRow[] = [];
    for (const principle of CHARTER_PRINCIPLE_LIST) {
      const draft = adapter.recommend(adapterUc, principle as CharterPrinciple);
      const fromClaude = trizPayloadFromClaude?.find((c) => c.triz_principle === principle);
      const insertRow: Omit<RecommendationRow, "id" | "created_at"> = {
        use_case_id: uc.id,
        user_id: uc.user_id,
        iteration,
        triz_principle: principle,
        applicability_score: fromClaude?.applicability_score ?? draft.applicability_score,
        knob: draft.knob,
        diff_summary: draft.diff_summary,
        payload: fromClaude?.payload ?? draft.payload,
        rationale: fromClaude?.rationale ?? draft.rationale,
        expected_engines: draft.expected_engines,
        claude_run_id: claudeRunId,
      };
      const inserted = await insertReturning<RecommendationRow>(sb, "recommendations", insertRow);
      if (inserted) rows.push(inserted);
    }
    return ok({ recommendations: rows, claude_run_id: claudeRunId });
  },
};

// ---------------------------------------------------------------------------
// Tool: pull_apply_artifact
// ---------------------------------------------------------------------------

export const pullApplyArtifact: ToolDescriptor<
  { use_case_id: string; recommendation_id: string },
  ArtifactPayload
> = {
  name: "pull_apply_artifact",
  description:
    "Build the apply artifact for one Recommendation. Does NOT persist anything; the dashboard writes the applications row after the user confirms.",
  inputSchema: {
    type: "object",
    properties: {
      use_case_id: { type: "string" },
      recommendation_id: { type: "string" },
    },
    required: ["use_case_id", "recommendation_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const sb = getSupabase(ctx);
    if (!sb) return err(errInternal("Supabase client not configured", "Set SUPABASE_SERVICE_ROLE_KEY"));
    const uc = await loadUseCase(sb, input.use_case_id);
    if (!uc) return err(errNotFound(`use case ${input.use_case_id} not found`, "Verify the id"));
    const recs = await loadList<RecommendationRow>(sb, "recommendations", uc.id);
    const rec = recs.find((r) => r.id === input.recommendation_id);
    if (!rec) {
      return err(errNotFound(`recommendation ${input.recommendation_id} not found for this use case`, "Verify the recommendation id"));
    }
    return ok(buildArtifact(rec, uc));
  },
};

/**
 * Build the apply artifact for one recommendation. Delegates to the
 * substrate adapter — the per-substrate output shape (unified diff /
 * paste-ready markdown / YouTube-Studio checklist) is the adapter's
 * concern, not the MCP layer's.
 */
export function buildArtifact(rec: RecommendationRow, uc: UseCaseRow): ArtifactPayload {
  const adapter = getAdapter(uc.substrate);
  const adapterUc = toAdapterUseCase(uc, rec.iteration);
  return adapter.applyArtifact(rec, adapterUc);
}

// ---------------------------------------------------------------------------
// Tool: pull_analyze
// ---------------------------------------------------------------------------

export const pullAnalyze: ToolDescriptor<
  { use_case_id: string; user_id: string; iteration?: number },
  AnalysisRow
> = {
  name: "pull_analyze",
  description:
    "Compute a verdict for one iteration's measurements vs the previous iteration; persist an Analysis row.",
  inputSchema: {
    type: "object",
    properties: {
      use_case_id: { type: "string" },
      user_id: { type: "string" },
      iteration: { type: "number" },
    },
    required: ["use_case_id", "user_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("pull_analyze");
    if (!limit.ok) return err(limit.error);
    const sb = getSupabase(ctx);
    if (!sb) return err(errInternal("Supabase client not configured", "Set SUPABASE_SERVICE_ROLE_KEY"));
    const uc = await loadUseCase(sb, input.use_case_id);
    if (!uc) return err(errNotFound(`use case ${input.use_case_id} not found`, "Verify the id"));
    if (uc.user_id !== input.user_id) {
      return err(errInvalidInput("user_id does not own use_case", "The caller must pass the use case's owner id"));
    }
    const iteration = input.iteration ?? uc.current_iteration;
    const measurements = await loadList<MeasurementRow>(sb, "measurements", uc.id);
    const current = measurements.filter((m) => m.iteration === iteration);
    const previous = measurements.filter((m) => m.iteration === iteration - 1);

    let verdict: AnalysisRow["verdict"] = "stub";
    let trizPrinciplesCited: string[] = [...CHARTER_PRINCIPLE_LIST];
    let claudeRunId: string | null = null;
    let suggestion: string | null = null;
    let perEngineDelta: Record<string, unknown> | null = null;
    let attractorMetrics: Record<string, unknown> | null = null;

    if (current.length === 0) {
      verdict = "inconclusive";
      suggestion = "No measurements recorded for this iteration. Submit at least 1 observation before analyzing.";
    } else {
      const cur = computeShare(current);
      const prev = previous.length ? computeShare(previous) : null;
      perEngineDelta = { current: cur, previous: prev };
      if (prev) {
        const curOverall = avg(Object.values(cur));
        const prevOverall = avg(Object.values(prev));
        if (curOverall > prevOverall + 0.05) verdict = "improved";
        else if (curOverall < prevOverall - 0.05) verdict = "regressed";
        else verdict = "stable";
      } else {
        verdict = "inconclusive";
        suggestion = "First iteration with measurements — establish baseline and run another iteration.";
      }
    }

    // Try Claude for a richer next-iteration suggestion + attractor metrics.
    const skill = await loadSkill(ctx, "pull-analyze");
    if (skill) {
      const prompt = `${skill}\n\nINPUT use_case=${JSON.stringify(uc)}\nINPUT iteration=${iteration}\nINPUT measurements_current=${JSON.stringify(current)}\nINPUT measurements_previous=${JSON.stringify(previous)}`;
      const r = await ctx.workers.claude.invoke(prompt, { timeoutMs: 120_000 });
      if (r.ok) {
        claudeRunId = `claude_${randomUUID().slice(0, 12)}`;
        const parsed = tryParseJsonBlock<{
          verdict?: AnalysisRow["verdict"];
          next_iteration_suggestion?: string;
          triz_principles_cited?: string[];
          attractor_metrics?: Record<string, unknown>;
        }>(r.value);
        if (parsed) {
          if (parsed.verdict) verdict = parsed.verdict;
          if (parsed.next_iteration_suggestion) suggestion = parsed.next_iteration_suggestion;
          if (parsed.triz_principles_cited && parsed.triz_principles_cited.length > 0) {
            trizPrinciplesCited = parsed.triz_principles_cited;
          }
          if (parsed.attractor_metrics) attractorMetrics = parsed.attractor_metrics;
        }
      }
    }

    const insertRow: Omit<AnalysisRow, "id" | "created_at"> = {
      use_case_id: uc.id,
      user_id: uc.user_id,
      iteration,
      verdict,
      per_engine_delta: perEngineDelta,
      attractor_metrics: attractorMetrics,
      triz_principles_cited: trizPrinciplesCited,
      next_iteration_suggestion: suggestion ?? null,
      claude_run_id: claudeRunId,
    };
    const inserted = await insertReturning<AnalysisRow>(sb, "analyses", insertRow);
    if (!inserted) {
      return err(errInternal("insert into analyses failed", "Check Supabase logs"));
    }
    return ok(inserted);
  },
};

function computeShare(rows: MeasurementRow[]): Record<string, number> {
  const out: Record<string, { cited: number; total: number }> = {};
  for (const r of rows) {
    if (!out[r.engine]) out[r.engine] = { cited: 0, total: 0 };
    out[r.engine]!.total += 1;
    if (r.citation_present) out[r.engine]!.cited += 1;
  }
  const share: Record<string, number> = {};
  for (const [engine, v] of Object.entries(out)) {
    share[engine] = v.total > 0 ? v.cited / v.total : 0;
  }
  return share;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// ---------------------------------------------------------------------------
// Deprecation envelopes — replaces the v0.2.0 trackCitations and
// readCitationTrend tools at registration time.
// ---------------------------------------------------------------------------

/**
 * Deprecation envelope (spec §5.2). The `Result` shape requires an
 * `ErrorCode` enum value, so we use `INVALID_INPUT` and embed the
 * `deprecated_v0_3_0` marker token in the message — this is what
 * downstream tests (`integration.http.test.ts`, `v0.3.0.test.ts`)
 * regex-match on.
 */
export const DEPRECATION_TOKEN = "deprecated_v0_3_0";
const DEPRECATION_MESSAGE =
  `${DEPRECATION_TOKEN}: Measurement leaves the plugin in v0.3.0; record observations in the dashboard at /use-cases/[id]/measurements/new.`;
const DEPRECATION_FIX =
  "Record observations in the dashboard; this tool will be removed in v0.4.0.";

export const trackCitationsDeprecated: ToolDescriptor<unknown, never> = {
  name: "track_citations",
  description:
    "[DEPRECATED in v0.3.0] Aggregate CitationFlag samples. Returns a deprecation envelope; use the dashboard measurement form.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler() {
    return err({
      code: "INVALID_INPUT",
      message: DEPRECATION_MESSAGE,
      actionable_next_step: DEPRECATION_FIX,
    });
  },
};

export const readCitationTrendDeprecated: ToolDescriptor<unknown, never> = {
  name: "read_citation_trend",
  description:
    "[DEPRECATED in v0.3.0] Build per-engine citation share trend. Returns a deprecation envelope; use the dashboard.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler() {
    return err({
      code: "INVALID_INPUT",
      message: DEPRECATION_MESSAGE,
      actionable_next_step: DEPRECATION_FIX,
    });
  },
};
