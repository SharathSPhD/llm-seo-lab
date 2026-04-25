import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLoopOnce } from "./loop.ts";
import type { JobRecord } from "../types.ts";

interface Recorded { tool: string; input: unknown }

function fakeMcp(byTool: Record<string, unknown | ((input: unknown) => unknown)>): { calls: Recorded[]; client: { call: (t: string, i: unknown) => Promise<unknown> } } {
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
    payload: { repo_path: "." },
  };
}

describe("runLoopOnce", () => {
  it("happy path: filters Tier-1 gaps above threshold, drafts brief, opens PR", async () => {
    const f = fakeMcp({
      read_config: {
        site_id: "s1",
        pages: ["/a", "/b"],
        evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
        pr_policy: { max_gaps_per_pr: 3 },
      },
      audit_page: {
        audit_id: "a_001",
        gaps: [
          { id: "g1", tactic: "cite_sources", tier: 1, predicted_lift_pp: 12, geo_paper_reference: "GEO §3.1" },
          { id: "g2", tactic: "quotation_addition", tier: 1, predicted_lift_pp: 8, geo_paper_reference: "GEO §3.2" },
          { id: "g3", tactic: "freshness", tier: 2, predicted_lift_pp: 4, geo_paper_reference: "—" },
          { id: "g4", tactic: "stat_addition", tier: 1, predicted_lift_pp: 3, geo_paper_reference: "GEO §3.3" },
        ],
      },
      generate_brief: { unified_diff: "diff --git a/x b/x\n" },
      open_pr: { pr_id: "pr:42", pr_url: "https://github.com/o/r/pull/42" },
    });

    const events: string[] = [];
    const r = await runLoopOnce(makeJob(), {
      mcp: f.client,
      emitProgress: (s) => events.push(s),
    });

    assert.equal(r.next_step, "human_review");
    assert.equal(r.gaps_filed, 2);
    assert.equal(r.pr_id, "pr:42");
    const briefCalls = f.calls.filter((c) => c.tool === "generate_brief");
    assert.equal(briefCalls.length, 2);
    assert.deepEqual(events, ["read_config", "audit_page", "generate_brief", "open_pr", "done"]);
  });

  it("calls emit_schema when an add_schema_markup gap is selected", async () => {
    const f = fakeMcp({
      read_config: {
        site_id: "s1",
        pages: ["/a"],
        evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
      },
      audit_page: {
        audit_id: "a_002",
        gaps: [
          { id: "g1", tactic: "add_schema_markup", tier: 1, predicted_lift_pp: 9, geo_paper_reference: "GEO §3.4" },
        ],
      },
      generate_brief: { unified_diff: "diff brief\n" },
      emit_schema: { unified_diff: "diff schema\n" },
      open_pr: { pr_id: "pr:43", pr_url: "https://github.com/o/r/pull/43" },
    });

    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.next_step, "human_review");
    assert.ok(f.calls.some((c) => c.tool === "emit_schema"));
  });

  it("returns no_qualifying_gaps when nothing passes the filter", async () => {
    const f = fakeMcp({
      read_config: {
        site_id: "s1",
        pages: ["/a"],
        evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
      },
      audit_page: {
        audit_id: "a_003",
        gaps: [{ id: "g1", tactic: "freshness", tier: 2, predicted_lift_pp: 2, geo_paper_reference: "—" }],
      },
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.next_step, "no_qualifying_gaps");
    assert.equal(r.gaps_filed, 0);
    assert.equal(f.calls.find((c) => c.tool === "open_pr"), undefined);
  });

  it("respects pr_policy.max_gaps_per_pr cap", async () => {
    const f = fakeMcp({
      read_config: {
        site_id: "s1",
        pages: ["/a"],
        evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
        pr_policy: { max_gaps_per_pr: 2 },
      },
      audit_page: {
        audit_id: "a_004",
        gaps: [
          { id: "g1", tactic: "cite_sources", tier: 1, predicted_lift_pp: 7, geo_paper_reference: "—" },
          { id: "g2", tactic: "stat_addition", tier: 1, predicted_lift_pp: 6, geo_paper_reference: "—" },
          { id: "g3", tactic: "quotation_addition", tier: 1, predicted_lift_pp: 5, geo_paper_reference: "—" },
        ],
      },
      generate_brief: { unified_diff: "x\n" },
      open_pr: { pr_id: "pr:44", pr_url: "u" },
    });
    const r = await runLoopOnce(makeJob(), { mcp: f.client });
    assert.equal(r.gaps_filed, 2);
  });
});
