import { test } from "node:test";
import assert from "node:assert/strict";
import { NodeFsWatcher } from "./fs_watcher.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("fs watcher emits events on file change", async () => {
  const dir = await mkdtemp(join(tmpdir(), "llmseolab-fs-"));
  const w = new NodeFsWatcher();
  const events: { type: string; path: string }[] = [];
  const stop = w.watch(dir, (e) => events.push(e));
  await new Promise((r) => setTimeout(r, 50));
  await writeFile(join(dir, "foo.txt"), "hello");
  await new Promise((r) => setTimeout(r, 200));
  stop();
  assert.ok(events.some((e) => e.path.includes("foo.txt")), `expected event for foo.txt, got ${JSON.stringify(events)}`);
  await rm(dir, { recursive: true, force: true });
});
