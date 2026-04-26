#!/usr/bin/env node
/**
 * scripts/import-jsonl.mjs
 *
 * v0.4.0 — rebuild local SQLite from canonical JSONL state files.
 *
 * Walks `data/use-cases/<id>/state.jsonl` and replays every event into
 * `data/state/llm-seo-lab.db`, applying the schema from
 * `infra/d1/migrations/0001_init.sql` first if needed.
 *
 * Use this on first boot, or to recover from a corrupted SQLite cache:
 * the JSONL is the source of truth.
 *
 * Usage:
 *   node scripts/import-jsonl.mjs                      # all use cases
 *   node scripts/import-jsonl.mjs <use_case_id> [...]  # specific ones
 *   node scripts/import-jsonl.mjs --reset              # wipe DB before import
 */

import { mkdir, readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = process.env.LLM_SEO_LAB_SQLITE ?? join(ROOT, "data/state/llm-seo-lab.db");
const BASE_DIR = join(ROOT, "data/use-cases");
const MIGRATION = readFileSync(join(ROOT, "infra/d1/migrations/0001_init.sql"), "utf8");

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const targets = args.filter((a) => !a.startsWith("--"));

function jsonOrNull(v) {
  return v == null ? null : JSON.stringify(v);
}

function applyEvent(db, ev) {
  switch (ev.type) {
    case "USE_CASE_CREATED": {
      const u = ev.use_case;
      db.prepare(
        `insert or replace into use_cases (
           id, user_id, url, substrate, title, topic, target_audience,
           current_stage, current_iteration, notes, created_at, updated_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        u.id,
        u.user_id,
        u.url,
        u.substrate,
        u.title,
        u.topic,
        u.target_audience ?? null,
        u.current_stage,
        u.current_iteration,
        u.notes ?? null,
        u.created_at,
        u.updated_at,
      );
      return;
    }
    case "STAGE_TRANSITION": {
      const e = ev.event;
      db.prepare(
        `insert or replace into use_case_events (
           id, use_case_id, user_id, from_stage, to_stage, iteration, payload, created_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        e.id,
        e.use_case_id,
        e.user_id,
        e.from_stage ?? null,
        e.to_stage,
        e.iteration,
        jsonOrNull(e.payload),
        e.created_at,
      );
      db.prepare(
        `update use_cases set current_stage = ?, current_iteration = ?, updated_at = ? where id = ?`,
      ).run(e.to_stage, e.iteration, e.created_at, e.use_case_id);
      return;
    }
    case "RECOMMENDATION_CREATED": {
      const r = ev.recommendation;
      db.prepare(
        `insert or replace into recommendations (
           id, use_case_id, user_id, iteration, triz_principle,
           applicability_score, knob, diff_summary, payload, rationale,
           expected_engines, claude_run_id, created_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        r.id,
        r.use_case_id,
        r.user_id,
        r.iteration,
        r.triz_principle,
        r.applicability_score,
        r.knob,
        r.diff_summary,
        JSON.stringify(r.payload ?? {}),
        r.rationale,
        JSON.stringify(r.expected_engines ?? []),
        r.claude_run_id ?? null,
        r.created_at,
      );
      return;
    }
    case "APPLICATION_CREATED": {
      const a = ev.application;
      db.prepare(
        `insert or replace into applications (
           id, use_case_id, recommendation_id, user_id, iteration,
           artifact_kind, artifact_summary, applied_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        a.id,
        a.use_case_id,
        a.recommendation_id,
        a.user_id,
        a.iteration,
        a.artifact_kind,
        a.artifact_summary,
        a.applied_at,
      );
      return;
    }
    case "MEASUREMENT_CREATED": {
      const m = ev.measurement;
      db.prepare(
        `insert or replace into measurements (
           id, use_case_id, user_id, iteration, engine, prompt,
           observed_answer, citation_present, citation_position,
           source_authority, notes, screenshot_path, observed_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        m.id,
        m.use_case_id,
        m.user_id,
        m.iteration,
        m.engine,
        m.prompt,
        m.observed_answer,
        m.citation_present ? 1 : 0,
        m.citation_position ?? null,
        m.source_authority ?? null,
        m.notes ?? null,
        m.screenshot_path ?? null,
        m.observed_at,
      );
      return;
    }
    case "ANALYSIS_CREATED": {
      const a = ev.analysis;
      db.prepare(
        `insert or replace into analyses (
           id, use_case_id, user_id, iteration, verdict,
           per_engine_delta, attractor_metrics, triz_principles_cited,
           next_iteration_suggestion, claude_run_id, created_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        a.id,
        a.use_case_id,
        a.user_id,
        a.iteration,
        a.verdict,
        jsonOrNull(a.per_engine_delta),
        jsonOrNull(a.attractor_metrics),
        jsonOrNull(a.triz_principles_cited),
        a.next_iteration_suggestion ?? null,
        a.claude_run_id ?? null,
        a.created_at,
      );
      return;
    }
    default:
      console.warn(`unknown event type ignored: ${ev.type}`);
  }
}

async function main() {
  if (reset && existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log(`reset: deleted ${DB_PATH}`);
  }

  await mkdir(dirname(DB_PATH), { recursive: true });
  const db = new BetterSqlite3(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATION);

  let ids = targets;
  if (ids.length === 0) {
    if (!existsSync(BASE_DIR)) {
      console.log(`no use case directory at ${BASE_DIR}`);
      db.close();
      return;
    }
    const entries = await readdir(BASE_DIR, { withFileTypes: true });
    ids = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  }

  let total = 0;
  const tx = db.transaction((events) => {
    for (const ev of events) applyEvent(db, ev);
  });

  for (const id of ids) {
    const file = join(BASE_DIR, id, "state.jsonl");
    if (!existsSync(file)) {
      console.warn(`skip ${id}: ${file} missing`);
      continue;
    }
    const text = await readFile(file, "utf8");
    const events = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);
    tx(events);
    console.log(`imported ${id}: ${events.length} events`);
    total += events.length;
  }

  console.log(`done: ${total} events into ${DB_PATH}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
