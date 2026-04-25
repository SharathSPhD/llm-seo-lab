import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobQueue } from "./queue.ts";
import { gracefulShutdown } from "./shutdown.ts";

describe("gracefulShutdown", () => {
  it("drains immediately when already idle and runs all closers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shutdown-"));
    try {
      const queue = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      let closes = 0;
      const r = await gracefulShutdown({
        queue,
        isIdle: () => true,
        drainTimeoutMs: 100,
        closeFns: [
          async () => { closes += 1; },
          async () => { closes += 1; },
        ],
      });
      assert.equal(r.drained, true);
      assert.equal(closes, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("waits for isIdle, then resolves drained=true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shutdown-"));
    try {
      const queue = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      let idle = false;
      setTimeout(() => { idle = true; }, 50);
      const r = await gracefulShutdown({
        queue,
        isIdle: () => idle,
        drainTimeoutMs: 500,
        closeFns: [],
      });
      assert.equal(r.drained, true);
      assert.ok(r.waited_ms >= 50);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns drained=false if timeout exceeded with running jobs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shutdown-"));
    try {
      const queue = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const r = await gracefulShutdown({
        queue,
        isIdle: () => false,
        drainTimeoutMs: 80,
        closeFns: [],
      });
      assert.equal(r.drained, false);
      assert.ok(r.waited_ms >= 80);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
