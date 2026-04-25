import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HealthServer } from "./health.ts";

describe("HealthServer", () => {
  it("returns the daemon health envelope on GET /health", async () => {
    let calls = 0;
    const srv = new HealthServer({
      health: () => {
        calls += 1;
        return {
          status: "ok",
          uptime_ms: 1234,
          queue_depth: 2,
          jobs_running: 1,
          jobs_completed: 5,
          jobs_failed: 0,
          claude_workers: 1,
          playwright_sessions: 0,
          ws_subscribers: 1,
        };
      },
    });
    const port = await srv.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { status: string; queue_depth: number };
      assert.equal(body.status, "ok");
      assert.equal(body.queue_depth, 2);
      assert.equal(calls, 1);
    } finally {
      await srv.close();
    }
  });

  it("returns 404 for other paths", async () => {
    const srv = new HealthServer({
      health: () => ({
        status: "ok",
        uptime_ms: 0,
        queue_depth: 0,
        jobs_running: 0,
        jobs_completed: 0,
        jobs_failed: 0,
        claude_workers: 0,
        playwright_sessions: 0,
        ws_subscribers: 0,
      }),
    });
    const port = await srv.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/nope`);
      assert.equal(res.status, 404);
    } finally {
      await srv.close();
    }
  });
});
