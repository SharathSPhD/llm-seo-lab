/**
 * Server-side action surface for the v0.3.0 dashboard.
 *
 * Spec: docs/v0.3.0/spec.md §6, §8.
 *
 * Two responsibility splits:
 *
 *   - **Direct Supabase writes** (this module) own user-driven CRUD:
 *     `use_cases`, `use_case_events`, `applications`, `measurements`.
 *     These run under the user's RLS-bound server client.
 *
 *   - **MCP-mediated writes** (this module via `McpHttpClient`) own
 *     Claude-CLI-driven persistence: `recommendations` (via `pull_recommend`)
 *     and `analyses` (via `pull_analyze`). MCP holds the service-role key
 *     and stamps the explicit `user_id` it received as part of its args;
 *     a Postgres trigger refuses cross-user writes.
 *
 * All functions accept an optional `deps` so unit tests can pass a mock
 * Supabase client (`SupabaseLike`) and a mock `McpHttpClient`. The page
 * components call them with no deps (production codepath).
 */

import type {
  Stage,
  Substrate,
  UseCaseRow,
  UseCaseEventRow,
  RecommendationRow,
  ApplicationRow,
  MeasurementRow,
  AnalysisRow,
  UseCaseStateBundle,
  ArtifactPayload,
} from "@llm-seo-lab/shared";
import { isLegalTransition, getAllowedTransitions } from "@llm-seo-lab/shared";
import type { McpHttpClient } from "../mcp-client.ts";
import { McpHttpClient as DefaultClient } from "../mcp-client.ts";

/**
 * Minimal Supabase client surface this module needs. Mirrors the shape
 * we already use in `mcp/src/tools/v030.ts` so server-side code can pass
 * either the real `SupabaseClient` from `@supabase/supabase-js` or a
 * test fake.
 */
export interface SupabaseLike {
  from(table: string): SupabaseQuery;
  auth?: {
    getUser?(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
}

export interface SupabaseQuery {
  select(cols?: string): SupabaseQuery;
  insert(row: unknown): SupabaseQuery;
  update(row: unknown): SupabaseQuery;
  eq(col: string, val: unknown): SupabaseQuery;
  order?(col: string, opts?: { ascending?: boolean }): Promise<{ data: unknown[]; error: unknown }>;
  maybeSingle?(): Promise<{ data: unknown; error: unknown }>;
  single?(): Promise<{ data: unknown; error: unknown }>;
  then?<TResult1, TResult2>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export interface UseCaseActionDeps {
  supabase?: SupabaseLike;
  mcp?: McpHttpClient;
}

function defaultMcp(): McpHttpClient {
  return new DefaultClient();
}

async function defaultSupabase(): Promise<SupabaseLike> {
  // Lazy-load the Next.js-bound server client so unit tests that pass a
  // fake never touch `next/headers`.
  const { getServerClient } = await import("../supabase/server.ts");
  return (await getServerClient()) as unknown as SupabaseLike;
}

// ---------------------------------------------------------------------------
// Listing + read paths
// ---------------------------------------------------------------------------

export interface ListUseCasesResult {
  use_cases: Array<UseCaseRow & { last_event_at: string | null }>;
  retrieved_at: string;
}

export async function listUseCases(deps: UseCaseActionDeps = {}): Promise<ListUseCasesResult> {
  const sb = deps.supabase ?? (await defaultSupabase());
  const q = sb.from("use_cases").select("*");
  const r = q.order ? await q.order("updated_at", { ascending: false }) : { data: [], error: null };
  if (r.error) throw new Error(`listUseCases failed: ${formatError(r.error)}`);
  const rows = (r.data as UseCaseRow[] | null) ?? [];
  // For each row, look up the latest event timestamp. This is one extra
  // round-trip for the dashboard list; we accept it for v0.3.0 alpha and
  // can replace it with a SQL view in v0.4.0.
  const out: ListUseCasesResult["use_cases"] = [];
  for (const row of rows) {
    const evQ = sb.from("use_case_events").select("created_at").eq("use_case_id", row.id);
    const evR = evQ.order ? await evQ.order("created_at", { ascending: false }) : { data: [], error: null };
    const evRows = ((evR.data as Array<{ created_at: string }> | null) ?? []);
    out.push({ ...row, last_event_at: evRows[0]?.created_at ?? null });
  }
  return { use_cases: out, retrieved_at: new Date().toISOString() };
}

export async function getUseCaseBundle(
  use_case_id: string,
  deps: UseCaseActionDeps = {},
): Promise<UseCaseStateBundle> {
  const mcp = deps.mcp ?? defaultMcp();
  return mcp.call<UseCaseStateBundle>("read_use_case_state", { use_case_id });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateUseCaseInput {
  user_id: string;
  url: string;
  substrate: Substrate;
  title: string;
  topic: string;
  target_audience?: string | null;
  notes?: string | null;
}

export async function createUseCase(
  input: CreateUseCaseInput,
  deps: UseCaseActionDeps = {},
): Promise<UseCaseRow> {
  const sb = deps.supabase ?? (await defaultSupabase());
  const insertRow = {
    user_id: input.user_id,
    url: input.url,
    substrate: input.substrate,
    title: input.title,
    topic: input.topic,
    target_audience: input.target_audience ?? null,
    notes: input.notes ?? null,
    current_stage: "DRAFT" as Stage,
    current_iteration: 0,
  };
  const r = await runInsertSelect<UseCaseRow>(sb, "use_cases", insertRow);
  if (!r) throw new Error("createUseCase: Supabase returned no row");
  return r;
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

export interface StageTransitionInput {
  use_case_id: string;
  user_id: string;
  from_stage: Stage;
  to_stage: Stage;
  iteration: number;
  payload?: Record<string, unknown>;
}

/**
 * Generic stage-transition action. Validates the transition locally
 * (fast feedback) and then delegates to MCP `record_use_case_event`,
 * which validates again and persists.
 */
export async function transitionStage(
  input: StageTransitionInput,
  deps: UseCaseActionDeps = {},
): Promise<UseCaseEventRow> {
  if (!isLegalTransition(input.from_stage, input.to_stage)) {
    throw new Error(
      `illegal_transition: ${input.from_stage} -> ${input.to_stage}. ` +
        `Allowed from ${input.from_stage}: ${getAllowedTransitions(input.from_stage).join(", ") || "(none)"}`,
    );
  }
  const mcp = deps.mcp ?? defaultMcp();
  return mcp.call<UseCaseEventRow>("record_use_case_event", input);
}

// ---------------------------------------------------------------------------
// DRAFT -> RECOMMENDED  (or ANALYZED -> RECOMMENDED)
// ---------------------------------------------------------------------------

export interface RecommendInput {
  use_case_id: string;
  user_id: string;
  iteration?: number;
}

export interface RecommendResult {
  recommendations: RecommendationRow[];
  claude_run_id: string | null;
  event: UseCaseEventRow;
}

export async function generateRecommendations(
  input: RecommendInput,
  current_stage: Stage,
  deps: UseCaseActionDeps = {},
): Promise<RecommendResult> {
  const mcp = deps.mcp ?? defaultMcp();
  const pull = await mcp.call<{ recommendations: RecommendationRow[]; claude_run_id: string | null }>(
    "pull_recommend",
    input,
  );
  // Decide the iteration we actually ran on (MCP may have inferred it
  // from the use case row).
  const runIteration =
    pull.recommendations[0]?.iteration ?? input.iteration ?? 0;
  const event = await transitionStage(
    {
      use_case_id: input.use_case_id,
      user_id: input.user_id,
      from_stage: current_stage,
      to_stage: "RECOMMENDED",
      iteration: runIteration,
      payload: { claude_run_id: pull.claude_run_id, count: pull.recommendations.length },
    },
    deps,
  );
  return { ...pull, event };
}

// ---------------------------------------------------------------------------
// RECOMMENDED -> APPLIED  (artifact build + applications row)
// ---------------------------------------------------------------------------

export interface ApplyInput {
  use_case_id: string;
  user_id: string;
  recommendation_id: string;
  iteration: number;
}

export interface ApplyResult {
  artifact: ArtifactPayload;
  application: ApplicationRow;
  event: UseCaseEventRow;
}

export async function applyRecommendation(
  input: ApplyInput,
  current_stage: Stage,
  deps: UseCaseActionDeps = {},
): Promise<ApplyResult> {
  const mcp = deps.mcp ?? defaultMcp();
  const artifact = await mcp.call<ArtifactPayload>("pull_apply_artifact", {
    use_case_id: input.use_case_id,
    recommendation_id: input.recommendation_id,
  });
  const sb = deps.supabase ?? (await defaultSupabase());
  const inserted = await runInsertSelect<ApplicationRow>(sb, "applications", {
    use_case_id: input.use_case_id,
    recommendation_id: input.recommendation_id,
    user_id: input.user_id,
    iteration: input.iteration,
    artifact_kind: artifact.artifact_kind,
    artifact_summary: artifact.primary.slice(0, 2048),
  });
  if (!inserted) throw new Error("applyRecommendation: applications insert returned no row");
  const event = await transitionStage(
    {
      use_case_id: input.use_case_id,
      user_id: input.user_id,
      from_stage: current_stage,
      to_stage: "APPLIED",
      iteration: input.iteration,
      payload: { recommendation_id: input.recommendation_id, artifact_kind: artifact.artifact_kind },
    },
    deps,
  );
  return { artifact, application: inserted, event };
}

// ---------------------------------------------------------------------------
// MEASURING -> MEASURED ... and the measurement insert itself
// ---------------------------------------------------------------------------

export interface RecordMeasurementInput {
  use_case_id: string;
  user_id: string;
  iteration: number;
  engine: string;
  prompt: string;
  observed_answer: string;
  citation_present: boolean;
  citation_position?: number | null;
  source_authority?: string | null;
  notes?: string | null;
  screenshot_path?: string | null;
}

export async function recordMeasurement(
  input: RecordMeasurementInput,
  deps: UseCaseActionDeps = {},
): Promise<MeasurementRow> {
  const sb = deps.supabase ?? (await defaultSupabase());
  const row = await runInsertSelect<MeasurementRow>(sb, "measurements", {
    use_case_id: input.use_case_id,
    user_id: input.user_id,
    iteration: input.iteration,
    engine: input.engine,
    prompt: input.prompt,
    observed_answer: input.observed_answer,
    citation_present: input.citation_present,
    citation_position: input.citation_position ?? null,
    source_authority: input.source_authority ?? null,
    notes: input.notes ?? null,
    screenshot_path: input.screenshot_path ?? null,
  });
  if (!row) throw new Error("recordMeasurement: insert returned no row");
  return row;
}

// ---------------------------------------------------------------------------
// MEASURED -> ANALYZED
// ---------------------------------------------------------------------------

export interface AnalyzeInput {
  use_case_id: string;
  user_id: string;
  iteration: number;
}

export interface AnalyzeResult {
  analysis: AnalysisRow;
  event: UseCaseEventRow;
}

export async function runAnalysis(
  input: AnalyzeInput,
  current_stage: Stage,
  deps: UseCaseActionDeps = {},
): Promise<AnalyzeResult> {
  const mcp = deps.mcp ?? defaultMcp();
  const analysis = await mcp.call<AnalysisRow>("pull_analyze", input);
  const event = await transitionStage(
    {
      use_case_id: input.use_case_id,
      user_id: input.user_id,
      from_stage: current_stage,
      to_stage: "ANALYZED",
      iteration: input.iteration,
      payload: { verdict: analysis.verdict, claude_run_id: analysis.claude_run_id },
    },
    deps,
  );
  return { analysis, event };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runInsertSelect<T>(
  sb: SupabaseLike,
  table: string,
  row: unknown,
): Promise<T | null> {
  const q = sb.from(table).insert(row).select();
  const r = q.single ? await q.single() : await (q as unknown as Promise<{ data: unknown; error: unknown }>);
  if (r.error) throw new Error(`${table} insert failed: ${formatError(r.error)}`);
  if (!r.data) return null;
  return r.data as T;
}

function formatError(e: unknown): string {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in (e as Record<string, unknown>)) {
    return String((e as { message: unknown }).message);
  }
  return JSON.stringify(e);
}
