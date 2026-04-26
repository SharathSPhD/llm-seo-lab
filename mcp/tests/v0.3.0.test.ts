/**
 * v0.3.0 cross-process MCP tests.
 *
 * Covers the 5 new citation-pull tools and the 2 v0.2.0 deprecation
 * envelopes (spec docs/v0.3.0/spec.md §5).
 *
 * Strategy: boot the in-process server, inject a fake Supabase client
 * into the tool context (the real Supabase RLS path is exercised by
 * infra/supabase/tests/rls.test.sql). Calls go through HTTP /rpc to
 * keep the wire-format contract honest.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.ts";
import type {
  Stage,
  Substrate,
  UseCaseRow,
  UseCaseEventRow,
  RecommendationRow,
  ApplicationRow,
  MeasurementRow,
  AnalysisRow,
  SupabaseLike,
} from "../src/tools/v030.ts";
import { isLegalTransition, buildArtifact, DEPRECATION_TOKEN } from "../src/tools/v030.ts";

interface Envelope<T> { ok: boolean; value?: T; error?: { code: string; message: string } }

async function callTool<T>(port: number, name: string, args: Record<string, unknown>): Promise<Envelope<T>> {
  const res = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  assert.equal(res.status, 200, `HTTP ${res.status} for tools/call ${name}`);
  const j = (await res.json()) as { result: Envelope<T>; error?: { code: number; message: string } };
  if (j.error) throw new Error(`json-rpc error ${j.error.code}: ${j.error.message}`);
  return j.result;
}

// -----------------------------------------------------------------------------
// In-memory Supabase fake — implements just enough of `SupabaseLike` to test
// the v0.3.0 tools end-to-end without a live project.
// -----------------------------------------------------------------------------

interface FakeStore {
  use_cases: UseCaseRow[];
  use_case_events: UseCaseEventRow[];
  recommendations: RecommendationRow[];
  applications: ApplicationRow[];
  measurements: MeasurementRow[];
  analyses: AnalysisRow[];
}

function newStore(): FakeStore {
  return {
    use_cases: [],
    use_case_events: [],
    recommendations: [],
    applications: [],
    measurements: [],
    analyses: [],
  };
}

function makeFakeSupabase(store: FakeStore): SupabaseLike {
  return {
    from(table: string) {
      const list = (store as unknown as Record<string, Record<string, unknown>[]>)[table];
      if (!list) {
        throw new Error(`unknown table in fake supabase: ${table}`);
      }
      return {
        select() {
          return {
            eq(col: string, val: unknown) {
              const filtered = list.filter((row) => row[col] === val);
              return {
                async order() {
                  return { data: filtered, error: null };
                },
                async maybeSingle() {
                  return { data: filtered[0] ?? null, error: null };
                },
                async single() {
                  if (filtered.length === 0) return { data: null, error: { message: "not found" } };
                  return { data: filtered[0]!, error: null };
                },
              };
            },
          };
        },
        insert(rows: unknown | unknown[]) {
          const arr = Array.isArray(rows) ? rows : [rows];
          const inserted: Record<string, unknown>[] = [];
          for (const row of arr) {
            const r = row as Record<string, unknown>;
            const id = (r["id"] as string | undefined) ?? cryptoRandomId();
            const stamp = new Date().toISOString();
            const finalRow = {
              ...r,
              id,
              created_at: r["created_at"] ?? stamp,
              applied_at: r["applied_at"] ?? stamp,
              observed_at: r["observed_at"] ?? stamp,
            };
            list.push(finalRow);
            inserted.push(finalRow);
          }
          return {
            async select() {
              return { data: inserted, error: null };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(col: string, val: unknown) {
              for (const row of list) {
                if (row[col] === val) Object.assign(row, patch);
              }
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };
}

function cryptoRandomId(): string {
  return "id_" + Math.random().toString(36).slice(2, 12);
}

async function bootServerWithFake(store: FakeStore): Promise<{ port: number; stop: () => Promise<void> }> {
  const s = await startServer({
    enableStdio: false,
    httpPort: 0,
    rateLimit: { capacity: 100, refillPerMinute: 6000 },
  });
  // Inject the fake Supabase into the live ToolContext so the v0.3.0
  // tools find it via `getSupabase(ctx)`.
  (s.ctx as unknown as { supabase: SupabaseLike }).supabase = makeFakeSupabase(store);
  return { port: s.http!.port, stop: () => s.http!.stop() };
}

function seedUseCase(store: FakeStore, partial: Partial<UseCaseRow> = {}): UseCaseRow {
  const ts = new Date().toISOString();
  const row: UseCaseRow = {
    id: partial.id ?? "uc_test_001",
    user_id: partial.user_id ?? "user_alice",
    url: partial.url ?? "https://www.technektar.dev/",
    substrate: partial.substrate ?? ("web" as Substrate),
    title: partial.title ?? "Tech Nektar landing",
    topic: partial.topic ?? "context engineering",
    target_audience: partial.target_audience ?? null,
    current_stage: partial.current_stage ?? ("DRAFT" as Stage),
    current_iteration: partial.current_iteration ?? 0,
    notes: partial.notes ?? null,
    created_at: partial.created_at ?? ts,
    updated_at: partial.updated_at ?? ts,
  };
  store.use_cases.push(row);
  return row;
}

// -----------------------------------------------------------------------------
// Pure-unit tests (no server, no HTTP)
// -----------------------------------------------------------------------------

test("isLegalTransition enforces the spec §3.2 transition table", () => {
  assert.equal(isLegalTransition("DRAFT", "RECOMMENDED"), true);
  assert.equal(isLegalTransition("DRAFT", "APPLIED"), false);
  assert.equal(isLegalTransition("RECOMMENDED", "APPLIED"), true);
  assert.equal(isLegalTransition("APPLIED", "REPUBLISHED"), true);
  assert.equal(isLegalTransition("REPUBLISHED", "MEASURING"), true);
  assert.equal(isLegalTransition("MEASURING", "MEASURED"), true);
  assert.equal(isLegalTransition("MEASURED", "ANALYZED"), true);
  assert.equal(isLegalTransition("ANALYZED", "RECOMMENDED"), true);
  assert.equal(isLegalTransition("ANALYZED", "MEASURING"), false);
  // ABANDONED is reachable from any non-terminal stage but is itself terminal.
  for (const s of ["DRAFT", "RECOMMENDED", "APPLIED", "REPUBLISHED", "MEASURING", "MEASURED", "ANALYZED"] as Stage[]) {
    assert.equal(isLegalTransition(s, "ABANDONED"), true, `expected ${s} -> ABANDONED legal`);
  }
  assert.equal(isLegalTransition("ABANDONED", "DRAFT"), false);
});

test("buildArtifact returns substrate-appropriate artifact kind", () => {
  const baseUc: UseCaseRow = {
    id: "uc_x", user_id: "u_x", url: "u", substrate: "web",
    title: "t", topic: "topic", target_audience: null,
    current_stage: "RECOMMENDED", current_iteration: 0, notes: null,
    created_at: "t", updated_at: "t",
  };
  const baseRec: RecommendationRow = {
    id: "rec_x", use_case_id: "uc_x", user_id: "u_x", iteration: 0,
    triz_principle: "atomic-snippet-density",
    applicability_score: 0.7, knob: "json_ld_faqpage",
    diff_summary: "x", payload: {}, rationale: "r",
    expected_engines: ["chatgpt"], claude_run_id: null, created_at: "t",
  };
  const web = buildArtifact(baseRec, baseUc);
  assert.equal(web.artifact_kind, "pr_diff");
  const sub = buildArtifact(baseRec, { ...baseUc, substrate: "substack" });
  assert.equal(sub.artifact_kind, "paste_markdown");
  const yt = buildArtifact(baseRec, { ...baseUc, substrate: "youtube" });
  assert.equal(yt.artifact_kind, "youtube_checklist");
});

// -----------------------------------------------------------------------------
// Cross-process tests via HTTP /rpc
// -----------------------------------------------------------------------------

test("HTTP: read_use_case_state returns the full bundle for a seeded use case", async () => {
  const store = newStore();
  const uc = seedUseCase(store);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool<{ use_case: UseCaseRow; events: unknown[]; recommendations: unknown[] }>(
      ctx.port,
      "read_use_case_state",
      { use_case_id: uc.id },
    );
    assert.equal(r.ok, true);
    assert.equal(r.value!.use_case.id, uc.id);
    assert.equal(r.value!.use_case.title, uc.title);
    assert.deepEqual(r.value!.events, []);
    assert.deepEqual(r.value!.recommendations, []);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: read_use_case_state NOT_FOUND for a missing id", async () => {
  const ctx = await bootServerWithFake(newStore());
  try {
    const r = await callTool(ctx.port, "read_use_case_state", { use_case_id: "missing_id" });
    assert.equal(r.ok, false);
    assert.equal(r.error!.code, "NOT_FOUND");
  } finally {
    await ctx.stop();
  }
});

test("HTTP: record_use_case_event accepts a legal transition", async () => {
  const store = newStore();
  const uc = seedUseCase(store);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool<UseCaseEventRow>(ctx.port, "record_use_case_event", {
      use_case_id: uc.id,
      user_id: uc.user_id,
      from_stage: "DRAFT",
      to_stage: "RECOMMENDED",
      iteration: 0,
    });
    assert.equal(r.ok, true);
    assert.equal(r.value!.to_stage, "RECOMMENDED");
    // The use_cases.current_stage should also have advanced.
    assert.equal(store.use_cases[0]!.current_stage, "RECOMMENDED");
  } finally {
    await ctx.stop();
  }
});

test("HTTP: record_use_case_event rejects an illegal transition with INVALID_INPUT", async () => {
  const store = newStore();
  const uc = seedUseCase(store);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool(ctx.port, "record_use_case_event", {
      use_case_id: uc.id,
      user_id: uc.user_id,
      from_stage: "DRAFT",
      to_stage: "MEASURED", // not allowed from DRAFT
      iteration: 0,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error!.code, "INVALID_INPUT");
    assert.match(r.error!.message, /illegal_transition/);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: pull_recommend persists one row per charter principle", async () => {
  const store = newStore();
  const uc = seedUseCase(store, { substrate: "web" });
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool<{ recommendations: RecommendationRow[] }>(
      ctx.port,
      "pull_recommend",
      { use_case_id: uc.id, user_id: uc.user_id },
    );
    assert.equal(r.ok, true);
    // Five charter principles are ratified in
    // docs/decisions/2026-04-26-citation-pull-charter.md.
    assert.equal(r.value!.recommendations.length, 5);
    const principles = new Set(r.value!.recommendations.map((x) => x.triz_principle));
    for (const expected of [
      "atomic-snippet-density",
      "semantic-anchor-stability",
      "q-shaped-subhead-lattice",
      "cross-engine-intermediary",
      "inverted-retrieval-target",
    ]) {
      assert.ok(principles.has(expected), `missing principle: ${expected}`);
    }
    // user_id matches the seeded owner.
    for (const rec of r.value!.recommendations) {
      assert.equal(rec.user_id, uc.user_id);
    }
  } finally {
    await ctx.stop();
  }
});

test("HTTP: pull_recommend rejects cross-user calls", async () => {
  const store = newStore();
  const uc = seedUseCase(store);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool(ctx.port, "pull_recommend", {
      use_case_id: uc.id,
      user_id: "user_eve_attacker",
    });
    assert.equal(r.ok, false);
    assert.equal(r.error!.code, "INVALID_INPUT");
  } finally {
    await ctx.stop();
  }
});

test("HTTP: pull_apply_artifact builds a substrate-correct artifact", async () => {
  const store = newStore();
  const uc = seedUseCase(store, { substrate: "substack" });
  const rec: RecommendationRow = {
    id: "rec_sub_1",
    use_case_id: uc.id,
    user_id: uc.user_id,
    iteration: 0,
    triz_principle: "atomic-snippet-density",
    applicability_score: 0.7,
    knob: "lede_rewrite",
    diff_summary: "Apply atomic-snippet-density via lede_rewrite for substack",
    payload: { stub: true },
    rationale: "test rationale",
    expected_engines: ["chatgpt"],
    claude_run_id: null,
    created_at: new Date().toISOString(),
  };
  store.recommendations.push(rec);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool<{ artifact_kind: string; primary: string; human_steps: string[] }>(
      ctx.port,
      "pull_apply_artifact",
      { use_case_id: uc.id, recommendation_id: rec.id },
    );
    assert.equal(r.ok, true);
    assert.equal(r.value!.artifact_kind, "paste_markdown");
    assert.ok(r.value!.human_steps.length > 0);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: pull_analyze writes an Analysis row and reports inconclusive on first iteration", async () => {
  const store = newStore();
  const uc = seedUseCase(store, { current_iteration: 0 });
  const ts = new Date().toISOString();
  const m: MeasurementRow = {
    id: "m1",
    use_case_id: uc.id,
    user_id: uc.user_id,
    iteration: 0,
    engine: "chatgpt",
    prompt: "Q?",
    observed_answer: "A.",
    citation_present: true,
    citation_position: 1,
    source_authority: "self",
    notes: null,
    screenshot_path: null,
    observed_at: ts,
  };
  store.measurements.push(m);
  const ctx = await bootServerWithFake(store);
  try {
    const r = await callTool<AnalysisRow>(ctx.port, "pull_analyze", {
      use_case_id: uc.id,
      user_id: uc.user_id,
    });
    assert.equal(r.ok, true);
    assert.equal(r.value!.iteration, 0);
    // First iteration with measurements but no prior baseline → inconclusive
    // (or stub if Claude was unavailable; both are acceptable per spec §5.1).
    assert.ok(["inconclusive", "stub"].includes(r.value!.verdict), `unexpected verdict: ${r.value!.verdict}`);
    assert.equal(store.analyses.length, 1);
  } finally {
    await ctx.stop();
  }
});

// -----------------------------------------------------------------------------
// Deprecation envelopes
// -----------------------------------------------------------------------------

test("HTTP: track_citations returns the v0.3.0 deprecation envelope", async () => {
  const ctx = await bootServerWithFake(newStore());
  try {
    const r = await callTool(ctx.port, "track_citations", {
      samples: [{ engine: "perplexity", question: "q", cited: true, sampled_at: "t", sampling_path: "claude_cli" }],
      topic: "t", window_start: "a", window_end: "b",
    });
    assert.equal(r.ok, false);
    assert.match(r.error!.message, new RegExp(DEPRECATION_TOKEN));
  } finally {
    await ctx.stop();
  }
});

test("HTTP: read_citation_trend returns the v0.3.0 deprecation envelope", async () => {
  const ctx = await bootServerWithFake(newStore());
  try {
    const r = await callTool(ctx.port, "read_citation_trend", {
      site_id: "x",
      topic: "y",
    });
    assert.equal(r.ok, false);
    assert.match(r.error!.message, new RegExp(DEPRECATION_TOKEN));
  } finally {
    await ctx.stop();
  }
});
