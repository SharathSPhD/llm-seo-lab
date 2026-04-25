import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLoopOnce } from "./loop.ts";
import { NoopPratyakshaClient, type PratyakshaClient, type ContextElement } from "../pratyaksha_client.ts";
import type { JobRecord } from "../types.ts";
import type { SiteConfig, PageAuditResult, ContentBrief, PrSummary } from "@llm-seo-lab/shared";

interface Recorded { tool: string; input: unknown }

function fakeMcp(byTool: Record<string, unknown | ((input: unknown) => unknown)>): {
  calls: Recorded[];
  client: { call: (t: string, i: unknown) => Promise<unknown> };
} {
  const calls: Recorded[] = [];
  return {
    calls,
    client: {
      async call(tool: string, input: unknown) {
        calls.push({ tool, input });
        const v = byTool[tool];
        if (v === undefined) throw new Error(`fake mcp: tool ${tool} not configured`);
        return typeof v === "function" ? (v as (i: unknown) => unknown)(input) : v;
      },
    },
  };
}

function makeJob(): JobRecord {
  return {
    id: "j1",
    site_id: "s1",
    kind: "loop",
    status: "running",
    enqueued_at: 0,
    attempt: 1,
    payload: { site_id: "s1" },
  };
}

function makeCfg(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    site_id: "s1",
    repo_path: "/tmp/r",
    site_url: "https://s1.example",
    tier: "indie",
    action_substrate: "git",
    engines: ["claude_ai"],
    topics: [],
    question_banks: {},
    evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
    rate_limits: {
      audit_page_per_minute: 10, oracle_query_per_minute: 10,
      generate_brief_per_minute: 5, open_pr_per_minute: 2,
    },
    telemetry: false,
    seed_pages: ["https://s1.example/p1"],
    ...overrides,
  };
}

function makeAudit(audit_id: string, gaps: PageAuditResult["gaps"]): PageAuditResult {
  return {
    page_url: "https://s1.example/p1",
    audit_id,
    timestamp: "2026-04-25T12:00:00Z",
    claude_model: "stub",
    scores: { cite_sources: 60, quotation_addition: 60, statistics_addition: 60, authoritative_tone: 60, schema_coverage: 60 },
    gaps,
  };
}

function makeBrief(brief_id: string): ContentBrief {
  return {
    brief_id,
    gap_id: brief_id.replace("brief_", "gap_"),
    page_url: "https://s1.example/p1",
    tactic: "cite_sources",
    evidence_tier: "tier1",
    rationale_md: "stub",
    diff_patch: "diff --git a/x b/x\n",
    revert_plan_md: "git revert HEAD",
    measurement_plan: { pre_merge_at: "t", post_merge_t_plus_1d: null, post_merge_t_plus_7d: null, post_merge_t_plus_14d: null },
    emitted_schema_blocks: [],
    created_at: "2026-04-25T12:00:00Z",
    claude_model: "stub",
  };
}

function makePr(pr_number: number, brief_id: string): PrSummary {
  return {
    pr_number,
    pr_url: `https://github.com/o/r/pull/${pr_number}`,
    branch: `aeo-fix/${brief_id}`,
    state: "open",
    brief_id,
    opened_at: "2026-04-25T12:00:00Z",
    age_days: 0,
    labels: ["aeo-loop", "needs-review"],
  };
}

interface FakePratyakshaState {
  store: Map<string, ContextElement>;
  setSakshiCalls: { content: string }[];
  contextInsertCalls: unknown[];
  contextRetrieveCalls: unknown[];
  detectConflictCalls: unknown[];
  sublateCalls: unknown[];
}

function fakePratyaksha(opts: { available?: boolean; seed?: ContextElement[] } = {}): {
  client: PratyakshaClient;
  state: FakePratyakshaState;
} {
  const state: FakePratyakshaState = {
    store: new Map(),
    setSakshiCalls: [],
    contextInsertCalls: [],
    contextRetrieveCalls: [],
    detectConflictCalls: [],
    sublateCalls: [],
  };
  for (const e of opts.seed ?? []) state.store.set(e.id, e);
  const client: PratyakshaClient = {
    available: opts.available ?? true,
    async setSakshi(input) { state.setSakshiCalls.push(input); return { ok: true, tokens: 0 }; },
    async contextInsert(input) {
      state.contextInsertCalls.push(input);
      state.store.set(input.id, {
        id: input.id, content: input.content, precision: input.precision,
        avacchedaka: { qualificand: input.qualificand, qualifier: input.qualifier, condition: input.condition, relation: input.relation ?? "inherence" },
        sublated_by: null,
      });
      return { ok: true, element_id: input.id };
    },
    async contextRetrieve(input) {
      state.contextRetrieveCalls.push(input);
      const elements: ContextElement[] = [];
      for (const e of state.store.values()) {
        if (e.avacchedaka.qualificand !== input.qualificand) continue;
        if (input.qualifier && e.avacchedaka.qualifier !== input.qualifier) continue;
        if ((input.precision_threshold ?? 0) > e.precision) continue;
        if (e.sublated_by) continue;
        elements.push(e);
      }
      return { ok: true, elements };
    },
    async detectConflict(input) {
      state.detectConflictCalls.push(input);
      return { ok: true, conflict_pairs: [] };
    },
    async sublateWithEvidence(input) {
      state.sublateCalls.push(input);
      const older = state.store.get(input.older_id);
      if (older) older.sublated_by = `pending-${Date.now()}`;
      return { ok: true };
    },
  };
  return { client, state };
}

describe("runLoopOnce", () => {
  it("happy path: filters Tier-1 gaps above threshold, drafts briefs, opens PR", async () => {
    const f = fakeMcp({
      read_config: makeCfg({ max_gaps_per_pr: 3 }),
      audit_page: makeAudit("a_001", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 12, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "no primary citations" },
        { gap_id: "g2", tactic: "quotation_addition", evidence_tier: "tier1", predicted_lift_pp: 8, geo_paper_reference: "GEO §3.2", page_locator: "main", rationale: "no expert quotes" },
        { gap_id: "g3", tactic: "freshness", evidence_tier: "tier2", predicted_lift_pp: 4, geo_paper_reference: "—", page_locator: "main", rationale: "stale" },
        { gap_id: "g4", tactic: "statistics_addition", evidence_tier: "tier1", predicted_lift_pp: 3, geo_paper_reference: "GEO §3.3", page_locator: "main", rationale: "below threshold" },
      ]),
      generate_brief: (input: unknown) => makeBrief(`brief_${(input as { gap: { gap_id: string } }).gap.gap_id}`),
      open_pr: makePr(42, "brief_g1"),
    });

    const events: string[] = [];
    const r = await runLoopOnce(makeJob(), {
      mcp: f.client,
      emitProgress: (s) => events.push(s),
    });

    assert.equal(r.next_step, "human_review");
    assert.equal(r.gaps_filed, 2, "tier-1 + above threshold yields 2 gaps");
    assert.equal(r.pr_id, "pr:42");
    assert.equal(r.pr_url, "https://github.com/o/r/pull/42");

    const briefCalls = f.calls.filter((c) => c.tool === "generate_brief");
    assert.equal(briefCalls.length, 2);
    for (const bc of briefCalls) {
      const inp = bc.input as Record<string, unknown>;
      assert.ok("gap" in inp, "generate_brief must receive a gap");
      assert.ok("page_url" in inp, "generate_brief must receive a page_url");
      assert.ok("page_html" in inp);
      assert.ok("repo_path" in inp);
    }

    const auditCall = f.calls.find((c) => c.tool === "audit_page")!;
    assert.deepEqual(auditCall.input, { page_url: "https://s1.example/p1" });

    const cfgCall = f.calls.find((c) => c.tool === "read_config")!;
    assert.deepEqual(cfgCall.input, { site_id: "s1" });

    const prCall = f.calls.find((c) => c.tool === "open_pr")!;
    const prInput = prCall.input as Record<string, unknown>;
    assert.equal(prInput["repo_path"], "/tmp/r");
    assert.equal(prInput["brief_id"], "brief_g1");
    assert.match(prInput["branch"] as string, /^aeo-fix\/a_001$/);

    assert.deepEqual(events, ["read_config", "audit_page", "manas", "buddhi", "open_pr", "done"]);
    assert.equal(r.buddhi?.pratyaksha_available, false, "default deps use NoopPratyakshaClient");
  });

  it("returns no_qualifying_gaps when nothing passes the filter", async () => {
    const f = fakeMcp({
      read_config: makeCfg(),
      audit_page: makeAudit("a_002", [
        { gap_id: "g1", tactic: "freshness", evidence_tier: "tier2", predicted_lift_pp: 2, geo_paper_reference: "—", page_locator: "main", rationale: "stale" },
      ]),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.next_step, "no_qualifying_gaps");
    assert.equal(r.gaps_filed, 0);
    assert.equal(f.calls.find((c) => c.tool === "open_pr"), undefined);
  });

  it("respects max_gaps_per_pr cap from SiteConfig", async () => {
    const f = fakeMcp({
      read_config: makeCfg({ max_gaps_per_pr: 2 }),
      audit_page: makeAudit("a_003", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 7, geo_paper_reference: "—", page_locator: "main", rationale: "x" },
        { gap_id: "g2", tactic: "statistics_addition", evidence_tier: "tier1", predicted_lift_pp: 6, geo_paper_reference: "—", page_locator: "main", rationale: "x" },
        { gap_id: "g3", tactic: "quotation_addition", evidence_tier: "tier1", predicted_lift_pp: 5, geo_paper_reference: "—", page_locator: "main", rationale: "x" },
      ]),
      generate_brief: (input: unknown) => makeBrief(`brief_${(input as { gap: { gap_id: string } }).gap.gap_id}`),
      open_pr: makePr(43, "brief_g1"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.gaps_filed, 2);
    assert.equal(f.calls.filter((c) => c.tool === "generate_brief").length, 2);
  });

  it("falls back to site_url when seed_pages is empty", async () => {
    const f = fakeMcp({
      read_config: makeCfg({ seed_pages: [] }),
      audit_page: (input: unknown) => {
        const url = (input as { page_url: string }).page_url;
        assert.equal(url, "https://s1.example", "fallback should be cfg.site_url");
        return makeAudit("a_004", []);
      },
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.next_step, "no_qualifying_gaps");
  });

  it("pratyaksha first-run: inserts every brief into the Avacchedaka store", async () => {
    const { client, state } = fakePratyaksha({ available: true });
    const f = fakeMcp({
      read_config: makeCfg({ max_gaps_per_pr: 2 }),
      audit_page: makeAudit("a_p1", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 12, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "x" },
        { gap_id: "g2", tactic: "statistics_addition", evidence_tier: "tier1", predicted_lift_pp: 8, geo_paper_reference: "GEO §3.3", page_locator: "main", rationale: "x" },
      ]),
      generate_brief: (input: unknown) => makeBrief(`brief_${(input as { gap: { gap_id: string } }).gap.gap_id}`),
      open_pr: makePr(50, "brief_g1"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client, pratyaksha: client });
    assert.equal(r.next_step, "human_review");
    assert.equal(r.gaps_filed, 2);
    assert.equal(r.buddhi?.pratyaksha_available, true);
    assert.equal(r.buddhi?.conflicts_detected, 0);
    assert.equal(r.buddhi?.sublations_recorded, 0);
    assert.equal(r.buddhi?.blocked_briefs, 0);
    assert.equal(state.contextInsertCalls.length, 2, "both briefs go into the store");
    assert.equal(state.contextRetrieveCalls.length, 2, "Buddhi consults the store before each PR");
  });

  it("pratyaksha sublation: lower-precision prior recommendation is superseded", async () => {
    const { client, state } = fakePratyaksha({
      available: true,
      seed: [
        {
          id: "old_brief_001",
          content: "freshness | tier=tier2 | lift=2pp | stale advice from a prior run",
          precision: 0.1,
          avacchedaka: { qualificand: "s1::https://s1.example/p1", qualifier: "cite_sources", condition: "tier=tier1", relation: "inherence" },
          sublated_by: null,
        },
      ],
    });
    const f = fakeMcp({
      read_config: makeCfg(),
      audit_page: makeAudit("a_p2", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 14, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "totally different rationale: cite primary GEO sources for the headline claim" },
      ]),
      generate_brief: makeBrief("brief_g1"),
      open_pr: makePr(51, "brief_g1"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client, pratyaksha: client });
    assert.equal(r.next_step, "human_review");
    assert.equal(r.gaps_filed, 1);
    assert.equal(r.buddhi?.conflicts_detected, 1, "one conflict found");
    assert.equal(r.buddhi?.sublations_recorded, 1, "and resolved by sublation");
    assert.equal(r.buddhi?.blocked_briefs, 0, "PR is not blocked since new brief has higher precision");
    assert.equal(state.sublateCalls.length, 1);
    assert.equal((state.sublateCalls[0] as { older_id: string }).older_id, "old_brief_001");
  });

  it("pratyaksha buddhi block: higher-precision prior keeps PR closed", async () => {
    const { client } = fakePratyaksha({
      available: true,
      seed: [
        {
          id: "old_brief_002",
          content: "cite_sources | tier=tier1 | lift=18pp | a much higher-precision prior recommendation already filed",
          precision: 0.95,
          avacchedaka: { qualificand: "s1::https://s1.example/p1", qualifier: "cite_sources", condition: "tier=tier1", relation: "inherence" },
          sublated_by: null,
        },
      ],
    });
    const f = fakeMcp({
      read_config: makeCfg(),
      audit_page: makeAudit("a_p3", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 6, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "lower-precision draft: a different angle on cite_sources but with weaker evidence" },
      ]),
      generate_brief: makeBrief("brief_g1"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client, pratyaksha: client });
    assert.equal(r.next_step, "buddhi_blocked");
    assert.equal(r.gaps_filed, 0);
    assert.equal(r.buddhi?.blocked_briefs, 1);
    assert.equal(f.calls.find((c) => c.tool === "open_pr"), undefined, "no PR opened when Buddhi blocks all briefs");
  });

  it("noop pratyaksha gracefully degrades when daemon was started without it", async () => {
    const f = fakeMcp({
      read_config: makeCfg(),
      audit_page: makeAudit("a_p4", [
        { gap_id: "g1", tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 9, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "x" },
      ]),
      generate_brief: makeBrief("brief_g1"),
      open_pr: makePr(52, "brief_g1"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client, pratyaksha: new NoopPratyakshaClient() });
    assert.equal(r.next_step, "human_review");
    assert.equal(r.buddhi?.pratyaksha_available, false);
  });

  it("audits every seed_page (multi-page audit)", async () => {
    const f = fakeMcp({
      read_config: makeCfg({ seed_pages: ["https://s1.example/a", "https://s1.example/b"] }),
      audit_page: (input: unknown) => {
        const url = (input as { page_url: string }).page_url;
        return {
          ...makeAudit("a_005", [
            { gap_id: `g-${url.slice(-1)}`, tactic: "cite_sources", evidence_tier: "tier1", predicted_lift_pp: 9, geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "x" },
          ]),
          page_url: url,
        };
      },
      generate_brief: (input: unknown) => makeBrief(`brief_${(input as { gap: { gap_id: string } }).gap.gap_id}`),
      open_pr: makePr(44, "brief_g-a"),
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.gaps_filed, 2, "one gap per page should yield 2 briefs");
    assert.equal(f.calls.filter((c) => c.tool === "audit_page").length, 2);
  });
});
