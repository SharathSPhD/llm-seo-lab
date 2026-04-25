import { test } from "node:test";
import assert from "node:assert/strict";
import { TokenBucket } from "./rate_limit.ts";

test("token bucket allows up to capacity then errors", async () => {
  const now = 1_000_000;
  const tb = new TokenBucket({ capacity: 3, refillPerMinute: 60, now: () => now });
  for (let i = 0; i < 3; i++) {
    const r = await tb.take("audit");
    assert.equal(r.ok, true, `take ${i} should succeed`);
  }
  const burst = await tb.take("audit");
  assert.equal(burst.ok, false);
  if (!burst.ok) {
    assert.equal(burst.error.code, "QUOTA_EXCEEDED");
    assert.ok(burst.error.retry_after_seconds! >= 1);
  }
});

test("token bucket refills over time", async () => {
  let now = 1_000_000;
  const tb = new TokenBucket({ capacity: 2, refillPerMinute: 60, now: () => now });
  await tb.take("k");
  await tb.take("k");
  assert.equal((await tb.take("k")).ok, false);
  now += 1_500;
  const r = await tb.take("k");
  assert.equal(r.ok, true, "should refill 1+ token after 1.5s at 1 token/sec");
});

test("buckets are per-key", async () => {
  const tb = new TokenBucket({ capacity: 1, refillPerMinute: 60 });
  const a = await tb.take("a");
  const b = await tb.take("b");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});
