import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  UseCaseRow,
  UseCaseEventRow,
  RecommendationRow,
  AnalysisRow,
  ArtifactPayload,
} from "@llm-seo-lab/shared";
import { McpHttpClient } from "../mcp-client.ts";
import {
  listUseCases,
  createUseCase,
  transitionStage,
  generateRecommendations,
  applyRecommendation,
  recordMeasurement,
  runAnalysis,
  type SupabaseLike,
} from "./use-cases.ts";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeFakeSupabase(seed: Partial<{
  use_cases: UseCaseRow[];
  use_case_events: UseCaseEventRow[];
}> = {}): SupabaseLike {
  const tables: Record<string, unknown[]> = {
    use_cases: seed.use_cases ?? [],
    use_case_events: seed.use_case_events ?? [],
    recommendations: [],
    applications: [],
    measurements: [],
    analyses: [],
  };

  function makeQuery(table: string): unknown {
    const filters: Array<{ col: string; val: unknown }> = [];
    let pendingInsert: unknown[] | null = null;
    const q = {
      select() {
        return q;
      },
      insert(row: unknown) {
        const arr = Array.isArray(row) ? row : [row];
        const stamped = arr.map((r) => ({
          id: `id-${tables[table]!.length + 1}`,
          created_at: new Date().toISOString(),
          ...(r as Record<string, unknown>),
        }));
        pendingInsert = stamped;
        return q;
      },
      update(_row: unknown) {
        return q;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return q;
      },
      async order(col: string, _opts?: { ascending?: boolean }) {
        let rows = [...(tables[table] ?? [])];
        for (const f of filters) {
          rows = rows.filter((r) => (r as Record<string, unknown>)[f.col] === f.val);
        }
        rows.sort((a, b) => {
          const av = String((a as Record<string, unknown>)[col] ?? "");
          const bv = String((b as Record<string, unknown>)[col] ?? "");
          return _opts?.ascending === false ? bv.localeCompare(av) : av.localeCompare(bv);
        });
        return { data: rows, error: null };
      },
      async maybeSingle() {
        let rows = [...(tables[table] ?? [])];
        for (const f of filters) {
          rows = rows.filter((r) => (r as Record<string, unknown>)[f.col] === f.val);
        }
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
        if (pendingInsert) {
          const inserted = pendingInsert[0];
          tables[table]!.push(inserted!);
          pendingInsert = null;
          return { data: inserted, error: null };
        }
        let rows = [...(tables[table] ?? [])];
        for (const f of filters) {
          rows = rows.filter((r) => (r as Record<string, unknown>)[f.col] === f.val);
        }
        return { data: rows[0] ?? null, error: null };
      },
      // Allow `await q` (the insert codepath uses single() now, but keep
      // this for parity with the production codepath).
      then<T>(onFulfilled?: (value: { data: unknown; error: unknown }) => T) {
        if (pendingInsert) {
          const inserted = pendingInsert;
          tables[table]!.push(...inserted);
          pendingInsert = null;
          return Promise.resolve({ data: inserted, error: null }).then(onFulfilled);
        }
        let rows = [...(tables[table] ?? [])];
        for (const f of filters) {
          rows = rows.filter((r) => (r as Record<string, unknown>)[f.col] === f.val);
        }
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
      },
    };
    return q;
  }

  return {
    from(table: string) {
      return makeQuery(table) as ReturnType<SupabaseLike["from"]>;
    },
  };
}

class FakeMcpClient extends McpHttpClient {
  private readonly handler: (tool: string, input: unknown) => unknown;
  constructor(handler: (tool: string, input: unknown) => unknown) {
    super({ endpoint: "http://unused" });
    this.handler = handler;
  }
  override async call<T>(tool: string, input: unknown): Promise<T> {
    return this.handler(tool, input) as T;
  }
}

const makeUseCase = (overrides: Partial<UseCaseRow> = {}): UseCaseRow => ({
  id: "uc-1",
  user_id: "u-1",
  url: "https://example.com",
  substrate: "web",
  title: "Example",
  topic: "context engineering",
  target_audience: null,
  current_stage: "DRAFT",
  current_iteration: 0,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listUseCases", () => {
  it("returns an empty list when the table is empty", async () => {
    const sb = makeFakeSupabase();
    const r = await listUseCases({ supabase: sb });
    assert.deepEqual(r.use_cases, []);
    assert.ok(r.retrieved_at);
  });

  it("returns rows decorated with last_event_at", async () => {
    const uc = makeUseCase();
    const ev: UseCaseEventRow = {
      id: "ev-1",
      use_case_id: uc.id,
      user_id: uc.user_id,
      from_stage: null,
      to_stage: "DRAFT",
      iteration: 0,
      payload: null,
      created_at: "2026-04-26T00:00:00.000Z",
    };
    const sb = makeFakeSupabase({ use_cases: [uc], use_case_events: [ev] });
    const r = await listUseCases({ supabase: sb });
    assert.equal(r.use_cases.length, 1);
    assert.equal(r.use_cases[0]!.last_event_at, ev.created_at);
  });
});

describe("createUseCase", () => {
  it("inserts a DRAFT row with iteration 0", async () => {
    const sb = makeFakeSupabase();
    const uc = await createUseCase(
      {
        user_id: "u-1",
        url: "https://www.technektar.dev",
        substrate: "web",
        title: "technektar.dev",
        topic: "AI engineer portfolio",
      },
      { supabase: sb },
    );
    assert.equal(uc.user_id, "u-1");
    assert.equal(uc.current_stage, "DRAFT");
    assert.equal(uc.current_iteration, 0);
    assert.equal(uc.target_audience, null);
  });
});

describe("transitionStage", () => {
  it("rejects illegal transitions before calling MCP", async () => {
    const mcp = new FakeMcpClient(() => {
      throw new Error("MCP should not be called for illegal transitions");
    });
    await assert.rejects(
      () =>
        transitionStage(
          {
            use_case_id: "uc-1",
            user_id: "u-1",
            from_stage: "DRAFT",
            to_stage: "REPUBLISHED", // illegal
            iteration: 0,
          },
          { mcp },
        ),
      /illegal_transition/,
    );
  });

  it("delegates legal transitions to record_use_case_event", async () => {
    const mcp = new FakeMcpClient((tool, input) => {
      assert.equal(tool, "record_use_case_event");
      return {
        id: "ev-x",
        ...(input as Record<string, unknown>),
        created_at: "2026-04-26T00:00:00Z",
      };
    });
    const ev = await transitionStage(
      {
        use_case_id: "uc-1",
        user_id: "u-1",
        from_stage: "DRAFT",
        to_stage: "RECOMMENDED",
        iteration: 0,
      },
      { mcp },
    );
    assert.equal(ev.to_stage, "RECOMMENDED");
  });
});

describe("generateRecommendations", () => {
  it("calls pull_recommend then transitions to RECOMMENDED with the run iteration", async () => {
    const calls: Array<{ tool: string; input: unknown }> = [];
    const mcp = new FakeMcpClient((tool, input) => {
      calls.push({ tool, input });
      if (tool === "pull_recommend") {
        const recs: RecommendationRow[] = [
          {
            id: "r-1",
            use_case_id: "uc-1",
            user_id: "u-1",
            iteration: 3,
            triz_principle: "atomic-snippet-density",
            applicability_score: 0.8,
            knob: "knob",
            diff_summary: "summary",
            payload: {},
            rationale: "rationale",
            expected_engines: ["chatgpt"],
            claude_run_id: "claude-1",
            created_at: "2026-04-26T00:00:00Z",
          },
        ];
        return { recommendations: recs, claude_run_id: "claude-1" };
      }
      if (tool === "record_use_case_event") {
        return { id: "ev-x", ...(input as Record<string, unknown>) } as UseCaseEventRow;
      }
      throw new Error(`unexpected tool ${tool}`);
    });
    const r = await generateRecommendations(
      { use_case_id: "uc-1", user_id: "u-1" },
      "DRAFT",
      { mcp },
    );
    assert.equal(r.recommendations.length, 1);
    assert.equal(r.event.to_stage, "RECOMMENDED");
    assert.equal(r.event.iteration, 3);
    assert.deepEqual(
      calls.map((c) => c.tool),
      ["pull_recommend", "record_use_case_event"],
    );
  });
});

describe("applyRecommendation", () => {
  it("builds the artifact, persists applications, and transitions to APPLIED", async () => {
    const sb = makeFakeSupabase();
    const mcp = new FakeMcpClient((tool, input) => {
      if (tool === "pull_apply_artifact") {
        const a: ArtifactPayload = {
          recommendation_id: (input as { recommendation_id: string }).recommendation_id,
          artifact_kind: "pr_diff",
          primary: "diff goes here",
          ancillary: { voice_profile: "clinical" },
          human_steps: ["Open PR", "Merge"],
        };
        return a;
      }
      if (tool === "record_use_case_event") {
        return { id: "ev-x", ...(input as Record<string, unknown>) } as UseCaseEventRow;
      }
      throw new Error(`unexpected tool ${tool}`);
    });
    const r = await applyRecommendation(
      {
        use_case_id: "uc-1",
        user_id: "u-1",
        recommendation_id: "r-1",
        iteration: 0,
      },
      "RECOMMENDED",
      { supabase: sb, mcp },
    );
    assert.equal(r.artifact.artifact_kind, "pr_diff");
    assert.equal(r.application.recommendation_id, "r-1");
    assert.equal(r.application.artifact_kind, "pr_diff");
    assert.equal(r.event.to_stage, "APPLIED");
  });
});

describe("recordMeasurement", () => {
  it("inserts a measurement row into Supabase", async () => {
    const sb = makeFakeSupabase();
    const m = await recordMeasurement(
      {
        use_case_id: "uc-1",
        user_id: "u-1",
        iteration: 0,
        engine: "chatgpt",
        prompt: "What is context engineering?",
        observed_answer: "Context engineering is …",
        citation_present: true,
        citation_position: 2,
        source_authority: "primary",
      },
      { supabase: sb },
    );
    assert.equal(m.engine, "chatgpt");
    assert.equal(m.citation_present, true);
    assert.equal(m.citation_position, 2);
  });
});

describe("runAnalysis", () => {
  it("calls pull_analyze and transitions to ANALYZED", async () => {
    const mcp = new FakeMcpClient((tool, input) => {
      if (tool === "pull_analyze") {
        const a: AnalysisRow = {
          id: "an-1",
          use_case_id: "uc-1",
          user_id: "u-1",
          iteration: 0,
          verdict: "improved",
          per_engine_delta: null,
          attractor_metrics: null,
          triz_principles_cited: ["atomic-snippet-density"],
          next_iteration_suggestion: "Try q-shaped subhead lattice.",
          claude_run_id: "claude-2",
          created_at: "2026-04-26T00:00:00Z",
        };
        return a;
      }
      if (tool === "record_use_case_event") {
        return { id: "ev-x", ...(input as Record<string, unknown>) } as UseCaseEventRow;
      }
      throw new Error(`unexpected tool ${tool}`);
    });
    const r = await runAnalysis(
      { use_case_id: "uc-1", user_id: "u-1", iteration: 0 },
      "MEASURED",
      { mcp },
    );
    assert.equal(r.analysis.verdict, "improved");
    assert.equal(r.event.to_stage, "ANALYZED");
  });
});
