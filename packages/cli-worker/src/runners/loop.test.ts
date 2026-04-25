import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLoopOnce } from "./loop.ts";
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

    assert.deepEqual(events, ["read_config", "audit_page", "generate_brief", "open_pr", "done"]);
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
