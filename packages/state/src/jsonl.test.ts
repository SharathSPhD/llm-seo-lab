/**
 * JSONL utilities + sinks unit tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  encodeEvent,
  parseEvent,
  parseJsonl,
  MemoryJsonlSink,
  type JsonlEvent,
} from "./jsonl.ts";
import { FsJsonlSink } from "./sinks/fs-jsonl.ts";

const sampleUseCase: JsonlEvent = {
  type: "USE_CASE_CREATED",
  use_case: {
    id: "uc-1",
    user_id: "user-a",
    url: "https://example.com",
    substrate: "web",
    title: "Example",
    topic: "demo",
    target_audience: null,
    current_stage: "DRAFT",
    current_iteration: 0,
    notes: null,
    created_at: "2026-04-26T10:00:00.000Z",
    updated_at: "2026-04-26T10:00:00.000Z",
  },
};

describe("jsonl helpers", () => {
  it("encodeEvent + parseEvent round-trip", () => {
    const line = encodeEvent(sampleUseCase);
    const parsed = parseEvent(line);
    assert.deepEqual(parsed, sampleUseCase);
  });

  it("parseEvent returns null for empty/blank/garbage lines", () => {
    assert.equal(parseEvent(""), null);
    assert.equal(parseEvent("   "), null);
    assert.equal(parseEvent("not json"), null);
  });

  it("parseJsonl skips blank and malformed lines", () => {
    const text = [
      encodeEvent(sampleUseCase),
      "",
      "not-json",
      encodeEvent({
        type: "STAGE_TRANSITION",
        event: {
          id: "ev-1",
          use_case_id: "uc-1",
          user_id: "user-a",
          from_stage: "DRAFT",
          to_stage: "RECOMMENDED",
          iteration: 0,
          payload: null,
          created_at: "2026-04-26T10:00:01.000Z",
        },
      }),
    ].join("\n");
    const events = parseJsonl(text);
    assert.equal(events.length, 2);
    assert.equal(events[0]!.type, "USE_CASE_CREATED");
    assert.equal(events[1]!.type, "STAGE_TRANSITION");
  });
});

describe("MemoryJsonlSink", () => {
  it("isolates events per use_case_id", () => {
    const sink = new MemoryJsonlSink();
    sink.append("a", sampleUseCase);
    sink.append("b", sampleUseCase);
    assert.equal(sink.read("a").length, 1);
    assert.equal(sink.read("b").length, 1);
    assert.equal(sink.read("c").length, 0);
  });
});

describe("FsJsonlSink", () => {
  it("appends one line per event in the right file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-jsonl-"));
    try {
      const sink = new FsJsonlSink({ baseDir: dir });
      await sink.append("uc-1", sampleUseCase);
      await sink.append("uc-1", {
        type: "STAGE_TRANSITION",
        event: {
          id: "ev-1",
          use_case_id: "uc-1",
          user_id: "user-a",
          from_stage: "DRAFT",
          to_stage: "RECOMMENDED",
          iteration: 0,
          payload: null,
          created_at: "2026-04-26T10:00:01.000Z",
        },
      });
      const file = join(dir, "uc-1", "state.jsonl");
      const text = readFileSync(file, "utf8");
      const lines = text.trimEnd().split("\n");
      assert.equal(lines.length, 2);
      const events = parseJsonl(text);
      assert.equal(events.length, 2);
      assert.equal(events[0]!.type, "USE_CASE_CREATED");
      assert.equal(events[1]!.type, "STAGE_TRANSITION");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
