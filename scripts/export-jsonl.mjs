#!/usr/bin/env node
/**
 * scripts/export-jsonl.mjs
 *
 * v0.4.0 — re-derive `data/use-cases/<id>/state.jsonl` from local SQLite.
 *
 * Reads every use case in `data/state/llm-seo-lab.db` (the local
 * JsonlSqliteDriver mirror) and rewrites the canonical JSONL files in
 * lexicographic event order (`USE_CASE_CREATED` first, then events
 * sorted by `created_at`).
 *
 * SQLite is a cache; JSONL is canonical. This script makes them
 * agree.
 *
 * Usage:
 *   node scripts/export-jsonl.mjs                     # rewrite all use cases
 *   node scripts/export-jsonl.mjs <use_case_id> [...] # rewrite specific ones
 *   node scripts/export-jsonl.mjs --dry-run           # print, don't write
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = process.env.LLM_SEO_LAB_SQLITE ?? join(ROOT, "data/state/llm-seo-lab.db");
const BASE_DIR = join(ROOT, "data/use-cases");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targets = args.filter((a) => !a.startsWith("--"));

function parseJson(s) {
  if (s == null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function rowToUseCase(r) {
  return {
    id: r.id,
    user_id: r.user_id,
    url: r.url,
    substrate: r.substrate,
    title: r.title,
    topic: r.topic,
    target_audience: r.target_audience ?? null,
    current_stage: r.current_stage,
    current_iteration: r.current_iteration,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToEvent(r) {
  return {
    id: r.id,
    use_case_id: r.use_case_id,
    user_id: r.user_id,
    from_stage: r.from_stage ?? null,
    to_stage: r.to_stage,
    iteration: r.iteration,
    payload: parseJson(r.payload),
    created_at: r.created_at,
  };
}

function rowToRecommendation(r) {
  return {
    id: r.id,
    use_case_id: r.use_case_id,
    user_id: r.user_id,
    iteration: r.iteration,
    triz_principle: r.triz_principle,
    applicability_score: r.applicability_score,
    knob: r.knob,
    diff_summary: r.diff_summary,
    payload: parseJson(r.payload) ?? {},
    rationale: r.rationale,
    expected_engines: parseJson(r.expected_engines) ?? [],
    claude_run_id: r.claude_run_id ?? null,
    created_at: r.created_at,
  };
}

function rowToApplication(r) {
  return {
    id: r.id,
    use_case_id: r.use_case_id,
    recommendation_id: r.recommendation_id,
    user_id: r.user_id,
    iteration: r.iteration,
    artifact_kind: r.artifact_kind,
    artifact_summary: r.artifact_summary,
    applied_at: r.applied_at,
  };
}

function rowToMeasurement(r) {
  return {
    id: r.id,
    use_case_id: r.use_case_id,
    user_id: r.user_id,
    iteration: r.iteration,
    engine: r.engine,
    prompt: r.prompt,
    observed_answer: r.observed_answer,
    citation_present: !!r.citation_present,
    citation_position: r.citation_position ?? null,
    source_authority: r.source_authority ?? null,
    notes: r.notes ?? null,
    screenshot_path: r.screenshot_path ?? null,
    observed_at: r.observed_at,
  };
}

function rowToAnalysis(r) {
  return {
    id: r.id,
    use_case_id: r.use_case_id,
    user_id: r.user_id,
    iteration: r.iteration,
    verdict: r.verdict,
    per_engine_delta: parseJson(r.per_engine_delta),
    attractor_metrics: parseJson(r.attractor_metrics),
    triz_principles_cited: parseJson(r.triz_principles_cited),
    next_iteration_suggestion: r.next_iteration_suggestion ?? null,
    claude_run_id: r.claude_run_id ?? null,
    created_at: r.created_at,
  };
}

/**
 * Build the list of JSONL events for a single use case in canonical order:
 * USE_CASE_CREATED first, then everything else sorted by timestamp.
 */
function buildEvents(db, useCaseId) {
  const useCase = db
    .prepare("select * from use_cases where id = ?")
    .get(useCaseId);
  if (!useCase) return [];
  const events = [];
  events.push({
    type: "USE_CASE_CREATED",
    use_case: rowToUseCase(useCase),
    _ts: useCase.created_at,
  });
  for (const r of db
    .prepare("select * from use_case_events where use_case_id = ?")
    .all(useCaseId)) {
    events.push({ type: "STAGE_TRANSITION", event: rowToEvent(r), _ts: r.created_at });
  }
  for (const r of db
    .prepare("select * from recommendations where use_case_id = ?")
    .all(useCaseId)) {
    events.push({
      type: "RECOMMENDATION_CREATED",
      recommendation: rowToRecommendation(r),
      _ts: r.created_at,
    });
  }
  for (const r of db
    .prepare("select * from applications where use_case_id = ?")
    .all(useCaseId)) {
    events.push({
      type: "APPLICATION_CREATED",
      application: rowToApplication(r),
      _ts: r.applied_at,
    });
  }
  for (const r of db
    .prepare("select * from measurements where use_case_id = ?")
    .all(useCaseId)) {
    events.push({
      type: "MEASUREMENT_CREATED",
      measurement: rowToMeasurement(r),
      _ts: r.observed_at,
    });
  }
  for (const r of db
    .prepare("select * from analyses where use_case_id = ?")
    .all(useCaseId)) {
    events.push({
      type: "ANALYSIS_CREATED",
      analysis: rowToAnalysis(r),
      _ts: r.created_at,
    });
  }
  events.sort((a, b) => {
    if (a.type === "USE_CASE_CREATED" && b.type !== "USE_CASE_CREATED") return -1;
    if (b.type === "USE_CASE_CREATED" && a.type !== "USE_CASE_CREATED") return 1;
    return String(a._ts).localeCompare(String(b._ts));
  });
  return events.map(({ _ts: _ignore, ...rest }) => rest);
}

async function main() {
  const db = new BetterSqlite3(DB_PATH, { readonly: true });
  try {
    const ids =
      targets.length > 0
        ? targets
        : db.prepare("select id from use_cases order by id").all().map((r) => r.id);

    if (ids.length === 0) {
      console.error(`No use cases found in ${DB_PATH}`);
      return;
    }

    for (const id of ids) {
      const events = buildEvents(db, id);
      const file = join(BASE_DIR, id, "state.jsonl");
      const text = events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
      if (dryRun) {
        console.log(`# ${file} (${events.length} events)`);
        console.log(text);
      } else {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, text, "utf8");
        console.log(`wrote ${file} (${events.length} events)`);
      }
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
