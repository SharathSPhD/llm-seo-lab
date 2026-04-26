/**
 * JsonlSqliteDriver unit tests.
 *
 * Uses an in-memory better-sqlite3 instance (`:memory:`) so the test
 * suite never touches the developer's local DB. Migration is loaded
 * from `infra/d1/migrations/0001_init.sql` so the test exercises the
 * exact same schema D1 uses in production.
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";

import { JsonlSqliteDriver } from "./jsonl-sqlite.ts";
import { MemoryJsonlSink } from "../jsonl.ts";
import {
  IllegalTransitionError,
  UseCaseNotFoundError,
  UseCaseOwnershipError,
} from "../errors.ts";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "..", "..", "..", "..", "..");
const MIGRATION = readFileSync(join(ROOT, "infra/d1/migrations/0001_init.sql"), "utf8");

function makeDriver() {
  const db = new BetterSqlite3(":memory:");
  db.exec(MIGRATION);
  const sink = new MemoryJsonlSink();
  let idCounter = 0;
  let nowCounter = 0;
  const driver = new JsonlSqliteDriver({
    db,
    sink,
    newId: () => `id-${String(++idCounter).padStart(4, "0")}`,
    now: () => `2026-04-26T10:00:${String(nowCounter++).padStart(2, "0")}.000Z`,
  });
  return { driver, db, sink };
}

describe("JsonlSqliteDriver — use case lifecycle", () => {
  it("createUseCase persists a row and emits USE_CASE_CREATED to JSONL", async () => {
    const { driver, sink } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "https://example.com",
      substrate: "web",
      title: "Example",
      topic: "demo",
      target_audience: null,
      notes: null,
    });
    assert.equal(uc.id, "id-0001");
    assert.equal(uc.current_stage, "DRAFT");
    assert.equal(uc.current_iteration, 0);
    const fetched = await driver.getUseCase("id-0001");
    assert.deepEqual(fetched, uc);
    const events = sink.read("id-0001");
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "USE_CASE_CREATED");
  });

  it("listUseCases returns user-owned use cases ordered by updated_at desc", async () => {
    const { driver } = makeDriver();
    await driver.createUseCase({
      user_id: "user-a",
      url: "u1",
      substrate: "web",
      title: "A",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    await driver.createUseCase({
      user_id: "user-b",
      url: "u2",
      substrate: "substack",
      title: "B",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const a = await driver.listUseCases("user-a");
    const b = await driver.listUseCases("user-b");
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.equal(a[0]!.url, "u1");
    assert.equal(b[0]!.url, "u2");
  });

  it("getUseCase returns null when not found", async () => {
    const { driver } = makeDriver();
    const r = await driver.getUseCase("nope");
    assert.equal(r, null);
  });
});

describe("JsonlSqliteDriver — stage transitions", () => {
  it("rejects illegal transitions before any SQL", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    await assert.rejects(
      driver.updateUseCaseStage({
        use_case_id: uc.id,
        user_id: "user-a",
        from_stage: "DRAFT",
        to_stage: "MEASURED",
        iteration: 0,
      }),
      IllegalTransitionError,
    );
  });

  it("rejects writes from a non-owner", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    await assert.rejects(
      driver.updateUseCaseStage({
        use_case_id: uc.id,
        user_id: "intruder",
        from_stage: "DRAFT",
        to_stage: "RECOMMENDED",
        iteration: 0,
      }),
      UseCaseOwnershipError,
    );
  });

  it("legal transition updates current_stage and emits STAGE_TRANSITION", async () => {
    const { driver, sink } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const event = await driver.updateUseCaseStage({
      use_case_id: uc.id,
      user_id: "user-a",
      from_stage: "DRAFT",
      to_stage: "RECOMMENDED",
      iteration: 0,
      payload: { count: 5 },
    });
    assert.equal(event.to_stage, "RECOMMENDED");
    const after = await driver.getUseCase(uc.id);
    assert.equal(after?.current_stage, "RECOMMENDED");
    const events = sink.read(uc.id);
    assert.equal(events.length, 2);
    assert.equal(events[1]!.type, "STAGE_TRANSITION");
  });
});

describe("JsonlSqliteDriver — child rows", () => {
  it("insertRecommendations preserves all five charter principles in JSONL", async () => {
    const { driver, sink } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const inserted = await driver.insertRecommendations(
      [
        "atomic-snippet-density",
        "semantic-anchor-stability",
        "q-shaped-subhead-lattice",
        "cross-engine-intermediary",
        "inverted-retrieval-target",
      ].map((p) => ({
        use_case_id: uc.id,
        user_id: "user-a",
        iteration: 0,
        triz_principle: p,
        applicability_score: 0.7,
        knob: "k",
        diff_summary: "d",
        payload: { p },
        rationale: "r",
        expected_engines: ["chatgpt"],
        claude_run_id: null,
      })),
    );
    assert.equal(inserted.length, 5);
    const events = sink.read(uc.id).filter((e) => e.type === "RECOMMENDATION_CREATED");
    assert.equal(events.length, 5);
    const bundle = await driver.getUseCaseBundle(uc.id);
    assert.equal(bundle.recommendations.length, 5);
    assert.deepEqual(
      bundle.recommendations.map((r) => r.triz_principle).sort(),
      [
        "atomic-snippet-density",
        "cross-engine-intermediary",
        "inverted-retrieval-target",
        "q-shaped-subhead-lattice",
        "semantic-anchor-stability",
      ],
    );
  });

  it("insertMeasurement round-trips citation_present boolean", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "substack",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const m = await driver.insertMeasurement({
      use_case_id: uc.id,
      user_id: "user-a",
      iteration: 0,
      engine: "ChatGPT",
      prompt: "p",
      observed_answer: "a",
      citation_present: true,
      citation_position: 1,
      source_authority: "own_site",
      notes: null,
      screenshot_path: null,
    });
    assert.equal(m.citation_present, true);
    const bundle = await driver.getUseCaseBundle(uc.id);
    assert.equal(bundle.measurements[0]!.citation_present, true);
  });

  it("insertAnalysis round-trips JSON columns", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "youtube",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const a = await driver.insertAnalysis({
      use_case_id: uc.id,
      user_id: "user-a",
      iteration: 0,
      verdict: "improved",
      per_engine_delta: { chatgpt: { before: 0, after: 1 } },
      attractor_metrics: { ftle_delta: -0.2 },
      triz_principles_cited: ["atomic-snippet-density"],
      next_iteration_suggestion: "try X",
      claude_run_id: null,
    });
    assert.equal(a.verdict, "improved");
    const bundle = await driver.getUseCaseBundle(uc.id);
    assert.deepEqual(bundle.analyses[0]!.per_engine_delta, {
      chatgpt: { before: 0, after: 1 },
    });
    assert.deepEqual(bundle.analyses[0]!.triz_principles_cited, [
      "atomic-snippet-density",
    ]);
  });

  it("rejects child writes for a non-existent use_case_id", async () => {
    const { driver } = makeDriver();
    await assert.rejects(
      driver.insertApplication({
        use_case_id: "ghost",
        recommendation_id: "ghost-rec",
        user_id: "user-a",
        iteration: 0,
        artifact_kind: "pr_diff",
        artifact_summary: "x",
      }),
      UseCaseNotFoundError,
    );
  });
});

describe("JsonlSqliteDriver — pending actions", () => {
  it("enqueuePendingAction stores a 'pending' row and reads it back", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const action = await driver.enqueuePendingAction({
      use_case_id: uc.id,
      requested_stage: "RECOMMENDED",
      requested_by: "user-a",
    });
    assert.equal(action.status, "pending");
    const list = await driver.readPendingActions({ user_id: "user-a" });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, action.id);
  });

  it("markActionExecuted flips status and persists result JSON", async () => {
    const { driver } = makeDriver();
    const uc = await driver.createUseCase({
      user_id: "user-a",
      url: "u",
      substrate: "web",
      title: "T",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const action = await driver.enqueuePendingAction({
      use_case_id: uc.id,
      requested_stage: "RECOMMENDED",
      requested_by: "user-a",
    });
    const updated = await driver.markActionExecuted({
      action_id: action.id,
      result: { ok: true, recs: 5 },
    });
    assert.equal(updated.status, "executed");
    assert.deepEqual(updated.result, { ok: true, recs: 5 });
    const remaining = await driver.readPendingActions({ user_id: "user-a" });
    assert.equal(remaining.length, 0);
  });

  it("readPendingActions can scope by use_case_id", async () => {
    const { driver } = makeDriver();
    const uc1 = await driver.createUseCase({
      user_id: "user-a",
      url: "u1",
      substrate: "web",
      title: "T1",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const uc2 = await driver.createUseCase({
      user_id: "user-a",
      url: "u2",
      substrate: "web",
      title: "T2",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    await driver.enqueuePendingAction({
      use_case_id: uc1.id,
      requested_stage: "RECOMMENDED",
      requested_by: "user-a",
    });
    await driver.enqueuePendingAction({
      use_case_id: uc2.id,
      requested_stage: "RECOMMENDED",
      requested_by: "user-a",
    });
    const justUc1 = await driver.readPendingActions({
      user_id: "user-a",
      use_case_id: uc1.id,
    });
    assert.equal(justUc1.length, 1);
    assert.equal(justUc1[0]!.use_case_id, uc1.id);
  });
});
