import { test } from "node:test";
import assert from "node:assert/strict";
import { ClaudeCliPool } from "./claude.ts";
import { EventEmitter } from "node:events";

function fakeSpawn(scenarios: Array<{ stdout?: string; stderr?: string; code: number; delayMs?: number }>) {
  let i = 0;
  return ((_cmd: string, _args: readonly string[]) => {
    const s = scenarios[i++ % scenarios.length]!;
    const proc = new EventEmitter() as unknown as {
      stdout: EventEmitter; stderr: EventEmitter; stdin: { end: (d: string) => void };
      kill: () => boolean; on: EventEmitter["on"]; emit: EventEmitter["emit"];
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = { end: (_data: string) => {} };
    proc.kill = () => true;
    setTimeout(() => {
      if (s.stdout) proc.stdout.emit("data", Buffer.from(s.stdout));
      if (s.stderr) proc.stderr.emit("data", Buffer.from(s.stderr));
      (proc as unknown as EventEmitter).emit("close", s.code);
    }, s.delayMs ?? 5);
    return proc as unknown as ReturnType<typeof import("node:child_process").spawn>;
  }) as unknown as typeof import("node:child_process").spawn;
}

test("claude pool runs successful invocations", async () => {
  const pool = new ClaudeCliPool({
    maxConcurrent: 2,
    spawner: fakeSpawn([{ stdout: "audit JSON here", code: 0 }]),
  });
  const r = await pool.invoke("audit this");
  assert.equal(r.ok, true);
  if (r.ok) assert.match(r.value, /audit JSON/);
});

test("claude pool surfaces quota errors", async () => {
  const pool = new ClaudeCliPool({
    maxConcurrent: 1,
    spawner: fakeSpawn([{ stderr: "rate limit exceeded", code: 1 }]),
  });
  const r = await pool.invoke("x");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "QUOTA_EXCEEDED");
    assert.ok(r.error.retry_after_seconds! > 0);
  }
});

test("claude pool surfaces non-quota errors", async () => {
  const pool = new ClaudeCliPool({
    maxConcurrent: 1,
    spawner: fakeSpawn([{ stderr: "auth failed", code: 1 }]),
  });
  const r = await pool.invoke("x");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "INTERNAL");
    assert.match(r.error.actionable_next_step, /claude login/i);
  }
});

test("claude pool respects max concurrency by queueing", async () => {
  const pool = new ClaudeCliPool({
    maxConcurrent: 1,
    spawner: fakeSpawn([{ stdout: "first", code: 0, delayMs: 30 }, { stdout: "second", code: 0, delayMs: 10 }]),
  });
  const a = pool.invoke("a");
  const b = pool.invoke("b");
  const stats = pool.stats();
  assert.ok(stats.inflight + stats.queue_depth >= 2);
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.ok, true);
  assert.equal(rb.ok, true);
});
