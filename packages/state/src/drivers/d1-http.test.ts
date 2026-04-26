/**
 * D1HttpDriver unit tests.
 *
 * D1 uses SQLite under the hood, so we reuse better-sqlite3 to back a
 * minimal `D1Like` adapter. Verifies that the same SQL strings,
 * row-mappers, and ownership invariants behave identically to the
 * local driver — the whole point of having two drivers behind one
 * StateDriver interface.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";

import { D1HttpDriver } from "./d1-http.ts";
import type { D1Like, D1PreparedLike } from "./d1-http.ts";
import {
  IllegalTransitionError,
  UseCaseNotFoundError,
  UseCaseOwnershipError,
} from "../errors.ts";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "..", "..", "..", "..", "..");
const MIGRATION = readFileSync(join(ROOT, "infra/d1/migrations/0001_init.sql"), "utf8");

/**
 * Adapter that wraps better-sqlite3 to expose the D1Database surface
 * the driver consumes. D1 is SQLite, so the bind/exec semantics line
 * up exactly; the only differences are async vs sync, and the
 * `meta.changes` shape we have to reconstruct.
 */
class FakeD1 implements D1Like {
  private readonly db: BetterSqlite3.Database;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  prepare(sql: string): D1PreparedLike {
    return new FakeD1Prepared(this.db, sql, []);
  }
}

class FakeD1Prepared implements D1PreparedLike {
  private readonly db: BetterSqlite3.Database;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(db: BetterSqlite3.Database, sql: string, params: unknown[]) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: unknown[]): D1PreparedLike {
    return new FakeD1Prepared(this.db, this.sql, [...this.params, ...params]);
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params) as T | undefined;
    return row ?? null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...this.params) as T[];
    return { results };
  }

  async run(): Promise<{ meta: { changes?: number } }> {
    const stmt = this.db.prepare(this.sql);
    const r = stmt.run(...this.params);
    return { meta: { changes: r.changes } };
  }
}

function makeDriver() {
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(MIGRATION);
  let idCounter = 0;
  let nowCounter = 0;
  const driver = new D1HttpDriver({
    db: new FakeD1(sqlite),
    newId: () => `id-${String(++idCounter).padStart(4, "0")}`,
    now: () => `2026-04-26T11:00:${String(nowCounter++).padStart(2, "0")}.000Z`,
  });
  return { driver, sqlite };
}

describe("D1HttpDriver — symmetry with JsonlSqliteDriver", () => {
  it("createUseCase and getUseCase round-trip", async () => {
    const { driver } = makeDriver();
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
    const fetched = await driver.getUseCase(uc.id);
    assert.deepEqual(fetched, uc);
  });

  it("listUseCases returns only the user's own use cases", async () => {
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
      substrate: "youtube",
      title: "B",
      topic: "t",
      target_audience: null,
      notes: null,
    });
    const a = await driver.listUseCases("user-a");
    assert.equal(a.length, 1);
    assert.equal(a[0]!.user_id, "user-a");
  });
});

describe("D1HttpDriver — invariants", () => {
  it("rejects illegal stage transitions", async () => {
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

  it("rejects writes from non-owner", async () => {
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
      driver.insertApplication({
        use_case_id: uc.id,
        recommendation_id: "anything",
        user_id: "intruder",
        iteration: 0,
        artifact_kind: "pr_diff",
        artifact_summary: "x",
      }),
      UseCaseOwnershipError,
    );
  });

  it("rejects writes for missing use_case_id", async () => {
    const { driver } = makeDriver();
    await assert.rejects(
      driver.insertMeasurement({
        use_case_id: "ghost",
        user_id: "user-a",
        iteration: 0,
        engine: "ChatGPT",
        prompt: "p",
        observed_answer: "a",
        citation_present: false,
        citation_position: null,
        source_authority: null,
        notes: null,
        screenshot_path: null,
      }),
      UseCaseNotFoundError,
    );
  });
});

describe("D1HttpDriver — bundle", () => {
  it("getUseCaseBundle aggregates all child rows", async () => {
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
    const recs = await driver.insertRecommendations([
      {
        use_case_id: uc.id,
        user_id: "user-a",
        iteration: 0,
        triz_principle: "atomic-snippet-density",
        applicability_score: 0.9,
        knob: "k",
        diff_summary: "d",
        payload: { foo: 1 },
        rationale: "r",
        expected_engines: ["chatgpt", "perplexity"],
        claude_run_id: null,
      },
    ]);
    await driver.insertApplication({
      use_case_id: uc.id,
      recommendation_id: recs[0]!.id,
      user_id: "user-a",
      iteration: 0,
      artifact_kind: "pr_diff",
      artifact_summary: "applied",
    });
    await driver.insertMeasurement({
      use_case_id: uc.id,
      user_id: "user-a",
      iteration: 0,
      engine: "ChatGPT",
      prompt: "p",
      observed_answer: "a",
      citation_present: true,
      citation_position: 2,
      source_authority: "own_site",
      notes: null,
      screenshot_path: null,
    });
    await driver.insertAnalysis({
      use_case_id: uc.id,
      user_id: "user-a",
      iteration: 0,
      verdict: "improved",
      per_engine_delta: { chatgpt: { before: 0, after: 1 } },
      attractor_metrics: { ftle_delta: -0.1 },
      triz_principles_cited: ["atomic-snippet-density"],
      next_iteration_suggestion: null,
      claude_run_id: null,
    });
    const bundle = await driver.getUseCaseBundle(uc.id);
    assert.equal(bundle.recommendations.length, 1);
    assert.equal(bundle.applications.length, 1);
    assert.equal(bundle.measurements.length, 1);
    assert.equal(bundle.analyses.length, 1);
    assert.deepEqual(bundle.recommendations[0]!.expected_engines, [
      "chatgpt",
      "perplexity",
    ]);
    assert.equal(bundle.measurements[0]!.citation_present, true);
    assert.equal(bundle.analyses[0]!.verdict, "improved");
  });
});

describe("D1HttpDriver — pending actions (intent queue)", () => {
  it("enqueue + read + markExecuted lifecycle", async () => {
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
    const action = await driver.enqueuePendingAction({
      use_case_id: uc.id,
      requested_stage: "RECOMMENDED",
      requested_by: "user-a",
    });
    assert.equal(action.status, "pending");

    const pending = await driver.readPendingActions({ user_id: "user-a" });
    assert.equal(pending.length, 1);

    const updated = await driver.markActionExecuted({
      action_id: action.id,
      result: { ok: true, recs: 5 },
    });
    assert.equal(updated.status, "executed");
    assert.deepEqual(updated.result, { ok: true, recs: 5 });

    const after = await driver.readPendingActions({ user_id: "user-a" });
    assert.equal(after.length, 0);
  });

  it("readPendingActions scopes to a single use_case_id when provided", async () => {
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
    const onlyUc1 = await driver.readPendingActions({
      user_id: "user-a",
      use_case_id: uc1.id,
    });
    assert.equal(onlyUc1.length, 1);
    assert.equal(onlyUc1[0]!.use_case_id, uc1.id);
  });

  it("markActionExecuted on a missing id throws", async () => {
    const { driver } = makeDriver();
    await assert.rejects(
      driver.markActionExecuted({ action_id: "ghost", result: {} }),
      /not found/,
    );
  });
});
