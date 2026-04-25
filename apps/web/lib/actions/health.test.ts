import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDaemonHealth } from "./health.ts";

describe("getDaemonHealth", () => {
  it("returns ok when daemon responds 200", async () => {
    const res = await getDaemonHealth({
      url: "http://x/health",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            uptime_ms: 1000,
            queue_depth: 0,
            jobs_running: 0,
            jobs_completed: 0,
            jobs_failed: 0,
            claude_workers: 1,
            playwright_sessions: 0,
            ws_subscribers: 1,
          }),
          { status: 200 },
        )) as unknown as typeof fetch,
    });
    assert.equal(res.status, "ok");
    assert.equal(res.queue_depth, 0);
    assert.equal(res.claude_workers, 1);
  });

  it("returns down when fetch throws (daemon offline)", async () => {
    const res = await getDaemonHealth({
      url: "http://x/health",
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    assert.equal(res.status, "down");
    assert.match(res.error ?? "", /ECONNREFUSED/);
  });

  it("returns down on non-200 HTTP status", async () => {
    const res = await getDaemonHealth({
      url: "http://x/health",
      fetchImpl: (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch,
    });
    assert.equal(res.status, "down");
    assert.match(res.error ?? "", /HTTP 503/);
  });
});
