import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobQueue } from "./queue.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "queue-test-"));
}

describe("JobQueue", () => {
  it("enqueue assigns an id and persists to journal", () => {
    const dir = tmp();
    try {
      const q = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const job = q.enqueue({ site_id: "s1", kind: "audit" });
      assert.equal(job.status, "queued");
      assert.ok(job.id.length > 0);
      const raw = readFileSync(join(dir, "queue.jsonl"), "utf8");
      assert.ok(raw.includes(job.id));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("survives restart by replaying the journal", () => {
    const dir = tmp();
    try {
      const path = join(dir, "queue.jsonl");
      const q1 = new JobQueue({ journal_path: path });
      const job = q1.enqueue({ site_id: "s1", kind: "audit", payload: { foo: "bar" } });

      const q2 = new JobQueue({ journal_path: path });
      const replayed = q2.get(job.id);
      assert.ok(replayed, "job should be present after replay");
      assert.equal(replayed.status, "queued");
      assert.deepEqual(replayed.payload, { foo: "bar" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("update transitions and persists state", () => {
    const dir = tmp();
    try {
      const q = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const job = q.enqueue({ site_id: "s1", kind: "audit" });
      const updated = q.update(job.id, { status: "running", started_at: 100, attempt: 1 });
      assert.equal(updated?.status, "running");
      assert.equal(updated?.attempt, 1);

      const q2 = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      assert.equal(q2.get(job.id)?.status, "running");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("next() returns the oldest queued job", () => {
    const dir = tmp();
    try {
      const q = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const a = q.enqueue({ site_id: "s1", kind: "audit" });
      q.enqueue({ site_id: "s1", kind: "fix" });
      assert.equal(q.next()?.id, a.id);
      q.update(a.id, { status: "running" });
      assert.equal(q.next()?.kind, "fix");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("compact removes old terminal jobs and rewrites the journal", () => {
    const dir = tmp();
    try {
      let nowMs = 1_000_000;
      const q = new JobQueue({ journal_path: join(dir, "queue.jsonl"), now: () => nowMs });
      const old = q.enqueue({ site_id: "s1", kind: "audit" });
      q.update(old.id, { status: "succeeded", finished_at: nowMs });
      nowMs += 30 * 24 * 60 * 60 * 1000;
      const fresh = q.enqueue({ site_id: "s1", kind: "audit" });
      const removed = q.compact({ keep_terminal_after: nowMs - 7 * 24 * 60 * 60 * 1000 });
      assert.equal(removed, 1);
      assert.equal(q.get(old.id), undefined);
      assert.ok(q.get(fresh.id));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("depth counts queued + running", () => {
    const dir = tmp();
    try {
      const q = new JobQueue({ journal_path: join(dir, "queue.jsonl") });
      const a = q.enqueue({ site_id: "s1", kind: "audit" });
      q.enqueue({ site_id: "s1", kind: "fix" });
      assert.equal(q.depth(), 2);
      q.update(a.id, { status: "succeeded", finished_at: 1 });
      assert.equal(q.depth(), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
