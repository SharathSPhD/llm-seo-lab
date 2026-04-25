import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TierRateLimiter } from "./rate_limit.ts";

describe("TierRateLimiter", () => {
  it("indie tier audit_page cap = 10/min: first 10 take() calls succeed, 11th waits", () => {
    const now = 0;
    const r = new TierRateLimiter({ now: () => now });
    for (let i = 0; i < 10; i += 1) {
      const v = r.take({ site_id: "s1", tier: "indie", action: "audit_page_per_minute" });
      assert.equal(v.ok, true, `call ${i + 1} should succeed`);
    }
    const denied = r.take({ site_id: "s1", tier: "indie", action: "audit_page_per_minute" });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, "QUOTA_EXCEEDED");
      assert.ok((denied.error.retry_after_seconds ?? 0) > 0);
    }
  });

  it("refills proportionally over time", () => {
    let now = 0;
    const r = new TierRateLimiter({ now: () => now });
    for (let i = 0; i < 10; i += 1) {
      r.take({ site_id: "s1", tier: "indie", action: "audit_page_per_minute" });
    }
    now = 30_000;
    const v = r.take({ site_id: "s1", tier: "indie", action: "audit_page_per_minute" });
    assert.equal(v.ok, true);
  });

  it("buckets are isolated per site and per action", () => {
    const r = new TierRateLimiter({ now: () => 0 });
    for (let i = 0; i < 10; i += 1) {
      r.take({ site_id: "s1", tier: "indie", action: "audit_page_per_minute" });
    }
    const otherSite = r.take({ site_id: "s2", tier: "indie", action: "audit_page_per_minute" });
    assert.equal(otherSite.ok, true);
    const otherAction = r.take({ site_id: "s1", tier: "indie", action: "open_pr_per_minute" });
    assert.equal(otherAction.ok, true);
  });

  it("higher tier has higher cap", () => {
    const r = new TierRateLimiter({ now: () => 0 });
    for (let i = 0; i < 60; i += 1) {
      const v = r.take({ site_id: "s1", tier: "studio", action: "audit_page_per_minute" });
      assert.equal(v.ok, true, `studio call ${i + 1} should succeed (cap 60)`);
    }
    const denied = r.take({ site_id: "s1", tier: "studio", action: "audit_page_per_minute" });
    assert.equal(denied.ok, false);
  });
});
