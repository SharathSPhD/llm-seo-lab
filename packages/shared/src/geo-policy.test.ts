import { test } from "node:test";
import assert from "node:assert/strict";
import { TACTIC_TIER, TACTIC_REFERENCE, rankTacticByEvidence } from "./geo-policy.ts";

test("tier-1 tactics are the GEO-paper supported triple", () => {
  assert.equal(TACTIC_TIER.cite_sources, "tier1");
  assert.equal(TACTIC_TIER.quotation_addition, "tier1");
  assert.equal(TACTIC_TIER.statistics_addition, "tier1");
});

test("schema_coverage and freshness are tier-2", () => {
  assert.equal(TACTIC_TIER.schema_coverage, "tier2");
  assert.equal(TACTIC_TIER.freshness, "tier2");
});

test("every tactic has a reference string", () => {
  for (const tactic of Object.keys(TACTIC_TIER) as (keyof typeof TACTIC_TIER)[]) {
    assert.ok(TACTIC_REFERENCE[tactic], `missing reference for ${tactic}`);
    assert.ok(TACTIC_REFERENCE[tactic].length > 10);
  }
});

test("ranking puts tier-1 before tier-2", () => {
  assert.ok(rankTacticByEvidence("cite_sources", "schema_coverage") < 0);
  assert.ok(rankTacticByEvidence("freshness", "quotation_addition") > 0);
  assert.equal(rankTacticByEvidence("cite_sources", "statistics_addition"), 0);
});
