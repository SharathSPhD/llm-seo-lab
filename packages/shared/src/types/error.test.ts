import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err } from "./error.ts";
import type { Result } from "./error.ts";

test("ok wraps value", () => {
  const r: Result<number> = ok(42);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 42);
});

test("err carries actionable_next_step", () => {
  const r = err({
    code: "QUOTA_EXCEEDED",
    message: "Claude CLI subscription quota hit",
    retry_after_seconds: 60,
    actionable_next_step: "Wait 60 seconds and retry",
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "QUOTA_EXCEEDED");
    assert.match(r.error.actionable_next_step, /retry/);
  }
});
