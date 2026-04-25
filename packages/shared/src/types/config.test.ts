import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RATE_LIMITS_BY_TIER, DEFAULT_SITE_CONFIG } from "./config.ts";

test("rate limits scale with tier", () => {
  assert.ok(DEFAULT_RATE_LIMITS_BY_TIER.indie.audit_page_per_minute < DEFAULT_RATE_LIMITS_BY_TIER.builder.audit_page_per_minute);
  assert.ok(DEFAULT_RATE_LIMITS_BY_TIER.builder.audit_page_per_minute < DEFAULT_RATE_LIMITS_BY_TIER.studio.audit_page_per_minute);
  assert.ok(DEFAULT_RATE_LIMITS_BY_TIER.studio.audit_page_per_minute < DEFAULT_RATE_LIMITS_BY_TIER.pro.audit_page_per_minute);
});

test("default config requires tier-1 first by default", () => {
  assert.equal(DEFAULT_SITE_CONFIG.evidence_policy.require_tier1_first, true);
  assert.equal(DEFAULT_SITE_CONFIG.evidence_policy.min_predicted_lift_pp, 5);
});

test("default action substrate is git", () => {
  assert.equal(DEFAULT_SITE_CONFIG.action_substrate, "git");
});

test("telemetry defaults to off", () => {
  assert.equal(DEFAULT_SITE_CONFIG.telemetry, false);
});
