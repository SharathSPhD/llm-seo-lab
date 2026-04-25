import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobQueue } from "../queue.ts";
import { parseArgs, scheduleMeasurement } from "./schedule-measurement.ts";

describe("parseArgs", () => {
  it("extracts --pr-id, --repo, --merged-at", () => {
    const a = parseArgs(["--pr-id", "42", "--repo", "o/r", "--merged-at", "2026-04-25T12:00:00Z"]);
    assert.equal(a.pr_id, "42");
    assert.equal(a.repo, "o/r");
    assert.equal(a.merged_at, "2026-04-25T12:00:00Z");
  });

  it("throws on missing required flags", () => {
    assert.throws(() => parseArgs(["--pr-id", "42"]), /requires/);
  });
});

describe("scheduleMeasurement", () => {
  it("enqueues a track job scheduled 14d after merge by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "sm-"));
    try {
      const queue = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const merged_at = "2026-04-25T00:00:00Z";
      const r = scheduleMeasurement(
        { pr_id: "42", repo: "o/r", merged_at, data_dir: dir },
        { queue, now: () => Date.parse(merged_at) },
      );
      const expected = Date.parse(merged_at) + 14 * 24 * 60 * 60 * 1000;
      assert.equal(r.scheduled_for_ms, expected);
      const job = queue.get(r.job_id);
      assert.equal(job?.kind, "track");
      assert.equal(job?.payload["pr_id"], "42");
      assert.equal(job?.payload["scheduled_for_ms"], expected);
      assert.equal(job?.payload["reason"], "post_merge_measurement");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respects custom measurement_window_days", () => {
    const dir = mkdtempSync(join(tmpdir(), "sm-"));
    try {
      const queue = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const merged_at = "2026-04-25T00:00:00Z";
      const r = scheduleMeasurement(
        { pr_id: "42", repo: "o/r", merged_at, measurement_window_days: 7, data_dir: dir },
        { queue },
      );
      assert.equal(r.scheduled_for_ms, Date.parse(merged_at) + 7 * 24 * 60 * 60 * 1000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid merged-at", () => {
    assert.throws(
      () => scheduleMeasurement({ pr_id: "42", repo: "o/r", merged_at: "garbage" }, {}),
      /invalid merged-at/,
    );
  });
});
