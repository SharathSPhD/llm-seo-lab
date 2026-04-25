import { test } from "node:test";
import assert from "node:assert/strict";
import { PlaywrightSessionPool } from "./playwright.ts";

test("playwright pool reuses alive sessions", async () => {
  let factoryCalls = 0;
  const pool = new PlaywrightSessionPool((engine) => {
    factoryCalls++;
    return { alive: true, query: async () => ({ cited_urls: [`https://${engine}.example/x`] }) };
  });
  await pool.query("perplexity", "q1");
  await pool.query("perplexity", "q2");
  await pool.query("chatgpt", "q3");
  assert.equal(factoryCalls, 2);
  assert.equal(pool.sessionsAlive(), 2);
});

test("playwright pool surfaces PLAYWRIGHT_AUTH_EXPIRED on dead session", async () => {
  const pool = new PlaywrightSessionPool(() => ({ alive: false, query: async () => ({ cited_urls: [] }) }));
  const r = await pool.query("perplexity", "q");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "PLAYWRIGHT_AUTH_EXPIRED");
});

test("playwright pool wraps thrown errors as INTERNAL", async () => {
  const pool = new PlaywrightSessionPool(() => ({
    alive: true,
    query: async () => { throw new Error("boom"); },
  }));
  const r = await pool.query("perplexity", "q");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "INTERNAL");
    assert.match(r.error.actionable_next_step, /screenshot/);
  }
});
