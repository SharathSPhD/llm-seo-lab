#!/usr/bin/env node
/**
 * scripts/seed-use-cases.mjs
 *
 * v0.3.0 R7 — offline seeding for the three real use cases:
 *
 *   - u1-technektar-dev (substrate=web)             → DRAFT → RECOMMENDED
 *   - u2-technektar-substack-context-window
 *     (substrate=substack)                          → DRAFT → RECOMMENDED →
 *                                                     APPLIED → REPUBLISHED →
 *                                                     MEASURING → MEASURED →
 *                                                     ANALYZED   (with 3 engine
 *                                                                 observations)
 *   - u3-youtube-fM2hpqPx8zg (substrate=youtube)    → DRAFT → RECOMMENDED →
 *                                                     APPLIED
 *
 * The script writes a deterministic `state.jsonl` per use case that mirrors
 * what the Supabase tables would contain after the same flow had been driven
 * via the dashboard. It is the v0.3.0 "git history" half of the dual-write
 * (Supabase = production source of truth, JSONL = audit-friendly local
 * mirror). The dashboard does not consume the JSONL; it is a record kept so
 * the repo is self-describing.
 *
 * Usage:
 *   node scripts/seed-use-cases.mjs            # write state.jsonl files
 *   node scripts/seed-use-cases.mjs --dry-run  # print the events but do not write
 *
 * The script does not require Supabase, MCP, or Claude on PATH — it imports
 * the substrate adapters directly via tsx-style ESM resolution. We use plain
 * Node ESM (--experimental-strip-types) on Node ≥ 22 to load the .ts adapter
 * sources; if your Node is older, run `npm run build` first to generate JS.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const isDryRun = process.argv.includes("--dry-run");

const CHARTER = [
  "atomic-snippet-density",
  "semantic-anchor-stability",
  "q-shaped-subhead-lattice",
  "cross-engine-intermediary",
  "inverted-retrieval-target",
];

const SEED_DIRS = [
  "u1-technektar-dev",
  "u2-technektar-substack-context-window",
  "u3-youtube-fM2hpqPx8zg",
];

// Deterministic ID generator — mirrors uuid v7 layout closely enough for
// the offline mirror (we don't need real cryptographic uniqueness here).
let counter = 0;
function detId(prefix) {
  counter += 1;
  return `${prefix}-seed-${String(counter).padStart(4, "0")}`;
}

function ts(daysAgo, hour = 12) {
  const d = new Date(Date.parse("2026-04-26T00:00:00.000Z"));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function loadAdapter(substrate) {
  // We import the .ts adapter via ESM-strip-types directly. Node 22+ runs
  // these without compilation thanks to --experimental-strip-types.
  const path = join(ROOT, "plugin/scripts/adapters", `${substrate}.ts`);
  // Use a file:// URL so Node's loader picks the right module type.
  const url = new URL(`file://${path}`).toString();
  const mod = await import(url);
  return mod[`${substrate}Adapter`];
}

async function loadConfig(dir) {
  const txt = await readFile(join(ROOT, "data/use-cases", dir, "config.json"), "utf8");
  return JSON.parse(txt);
}

function recommendationRow(uc, draft, iteration, createdAt) {
  return {
    id: detId(`rec-${uc.id}-${iteration}-${draft.triz_principle}`),
    use_case_id: uc.id,
    user_id: uc.owner ? `seed-${uc.owner.toLowerCase()}` : "seed-user",
    iteration,
    triz_principle: draft.triz_principle,
    applicability_score: draft.applicability_score,
    knob: draft.knob,
    diff_summary: draft.diff_summary,
    payload: draft.payload,
    rationale: draft.rationale,
    expected_engines: draft.expected_engines,
    claude_run_id: null,
    created_at: createdAt,
  };
}

function eventRow(uc, fromStage, toStage, iteration, payload, createdAt) {
  return {
    id: detId(`evt-${uc.id}-${toStage}`),
    use_case_id: uc.id,
    user_id: uc.owner ? `seed-${uc.owner.toLowerCase()}` : "seed-user",
    from_stage: fromStage,
    to_stage: toStage,
    iteration,
    payload,
    created_at: createdAt,
  };
}

function applicationRow(uc, rec, iteration, artifact, appliedAt) {
  return {
    id: detId(`app-${uc.id}-${iteration}`),
    use_case_id: uc.id,
    recommendation_id: rec.id,
    user_id: uc.owner ? `seed-${uc.owner.toLowerCase()}` : "seed-user",
    iteration,
    artifact_kind: artifact.artifact_kind,
    artifact_summary: artifact.primary.slice(0, 2048),
    applied_at: appliedAt,
  };
}

function measurementRow(uc, iteration, m, observedAt) {
  return {
    id: detId(`meas-${uc.id}-${iteration}-${m.engine}`),
    use_case_id: uc.id,
    user_id: uc.owner ? `seed-${uc.owner.toLowerCase()}` : "seed-user",
    iteration,
    engine: m.engine,
    prompt: m.prompt,
    observed_answer: m.observed_answer,
    citation_present: m.citation_present,
    citation_position: m.citation_position ?? null,
    source_authority: m.source_authority ?? null,
    notes: m.notes ?? null,
    screenshot_path: m.screenshot_path ?? null,
    observed_at: observedAt,
  };
}

function analysisRow(uc, iteration, verdict, createdAt) {
  return {
    id: detId(`ana-${uc.id}-${iteration}`),
    use_case_id: uc.id,
    user_id: uc.owner ? `seed-${uc.owner.toLowerCase()}` : "seed-user",
    iteration,
    verdict,
    per_engine_delta: {
      ChatGPT: { citation_present_before: false, citation_present_after: true },
      Perplexity: { citation_present_before: false, citation_present_after: true },
      "Google AIO": { citation_present_before: false, citation_present_after: false },
    },
    attractor_metrics: {
      goal_distance_before: 1.0,
      goal_distance_after: 0.62,
      ftle_delta: -0.18,
      basin_membership_after: "citation-pull",
    },
    triz_principles_cited: [
      "atomic-snippet-density",
      "inverted-retrieval-target",
    ],
    next_iteration_suggestion:
      "Iterate on `cross-engine-intermediary` next — Perplexity already cites; widen Wikipedia + canonical paper anchor block.",
    claude_run_id: null,
    created_at: createdAt,
  };
}

function adapterUseCase(cfg) {
  return {
    id: cfg.id,
    url: cfg.url,
    substrate: cfg.substrate,
    title: cfg.title,
    topic: cfg.topic,
    target_audience: cfg.target_audience ?? null,
    iteration: 0,
  };
}

async function buildEventsForU1(cfg, adapter) {
  // DRAFT -> RECOMMENDED
  const auc = adapterUseCase(cfg);
  const drafts = CHARTER.map((p) => adapter.recommend(auc, p));
  const t0 = ts(3, 9);
  const t1 = ts(3, 10);
  const events = [];
  events.push({
    type: "USE_CASE_CREATED",
    use_case: {
      id: cfg.id,
      user_id: `seed-${cfg.owner.toLowerCase()}`,
      url: cfg.url,
      substrate: cfg.substrate,
      title: cfg.title,
      topic: cfg.topic,
      target_audience: cfg.target_audience ?? null,
      current_stage: "DRAFT",
      current_iteration: 0,
      notes: cfg.notes ?? null,
      created_at: t0,
      updated_at: t0,
    },
  });
  const recs = drafts.map((d) => recommendationRow(auc, d, 0, t1));
  for (const r of recs) events.push({ type: "RECOMMENDATION_CREATED", recommendation: r });
  events.push({
    type: "STAGE_TRANSITION",
    event: eventRow(cfg, "DRAFT", "RECOMMENDED", 0, { count: recs.length }, t1),
  });
  return events;
}

async function buildEventsForU2(cfg, adapter) {
  // Full path through ANALYZED.
  const auc = adapterUseCase(cfg);
  const drafts = CHARTER.map((p) => adapter.recommend(auc, p));
  const t0 = ts(14, 9);
  const tRec = ts(14, 11);
  const tApp = ts(13, 14);
  const tRep = ts(12, 18);
  const tMs = ts(8, 9);
  const tMeas = [ts(7, 16), ts(6, 11), ts(5, 13)];
  const tMeasured = ts(5, 14);
  const tAnalyzed = ts(4, 12);

  const events = [];
  events.push({
    type: "USE_CASE_CREATED",
    use_case: {
      id: cfg.id,
      user_id: `seed-${cfg.owner.toLowerCase()}`,
      url: cfg.url,
      substrate: cfg.substrate,
      title: cfg.title,
      topic: cfg.topic,
      target_audience: cfg.target_audience ?? null,
      current_stage: "DRAFT",
      current_iteration: 0,
      notes: cfg.notes ?? null,
      created_at: t0,
      updated_at: t0,
    },
  });
  const recs = drafts.map((d) => recommendationRow(auc, d, 0, tRec));
  for (const r of recs) events.push({ type: "RECOMMENDATION_CREATED", recommendation: r });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "DRAFT", "RECOMMENDED", 0, { count: recs.length }, tRec) });

  // Apply the inverted-retrieval-target recommendation (highest-leverage for Substack lede).
  const chosen = recs.find((r) => r.triz_principle === "inverted-retrieval-target");
  const artifact = adapter.applyArtifact(chosen, auc);
  events.push({ type: "APPLICATION_CREATED", application: applicationRow(cfg, chosen, 0, artifact, tApp) });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "RECOMMENDED", "APPLIED", 0, { recommendation_id: chosen.id, artifact_kind: artifact.artifact_kind }, tApp) });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "APPLIED", "REPUBLISHED", 0, { revision: "context-window-v2-republished" }, tRep) });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "REPUBLISHED", "MEASURING", 0, { window: "5d" }, tMs) });

  // Three engine observations.
  const observations = [
    {
      engine: "ChatGPT",
      prompt: "When the LLM context window is huge, why do answers still drift? Cite a recent post.",
      observed_answer:
        "Long-context attention tends to under-weight middle-of-context tokens, leading to plot loss even with multi-million-token windows. See: technektar.substack.com — \"When the context window is big and you still lose the plot\".",
      citation_present: true,
      citation_position: 1,
      source_authority: "own_site",
      notes: "First citation slot. The bolded 'short answer' lede is being quoted nearly verbatim.",
    },
    {
      engine: "Perplexity",
      prompt: "What's the recent take on long-context degradation in LLMs?",
      observed_answer:
        "Most practitioners report that very large context windows still suffer from positional decay and 'lost in the middle'. Sources: Nelson Liu et al. (Lost in the Middle, 2023), and a recent essay on technektar.substack.com.",
      citation_present: true,
      citation_position: 2,
      source_authority: "own_site",
      notes: "Cited second after the canonical paper — the cross-engine-intermediary anchor block did its job.",
    },
    {
      engine: "Google AIO",
      prompt: "long context window LLM still loses plot",
      observed_answer:
        "AI Overview discusses context-window length and attention dilution but does not cite the Substack post; preview shows reddit and arxiv as top sources.",
      citation_present: false,
      citation_position: null,
      source_authority: null,
      notes: "Google AIO did not cite. Iteration 2 should target Google-friendly schema (FAQPage JSON-LD via web-substrate cousin or a companion technektar.dev page).",
    },
  ];
  for (let i = 0; i < observations.length; i += 1) {
    events.push({
      type: "MEASUREMENT_CREATED",
      measurement: measurementRow(cfg, 0, observations[i], tMeas[i]),
    });
  }
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "MEASURING", "MEASURED", 0, { count: observations.length }, tMeasured) });

  // Verdict: 2/3 engines cite => "improved" but not unanimous.
  events.push({ type: "ANALYSIS_CREATED", analysis: analysisRow(cfg, 0, "improved", tAnalyzed) });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "MEASURED", "ANALYZED", 0, { verdict: "improved" }, tAnalyzed) });
  return events;
}

async function buildEventsForU3(cfg, adapter) {
  const auc = adapterUseCase(cfg);
  const drafts = CHARTER.map((p) => adapter.recommend(auc, p));
  const t0 = ts(2, 9);
  const tRec = ts(2, 10);
  const tApp = ts(1, 17);

  const events = [];
  events.push({
    type: "USE_CASE_CREATED",
    use_case: {
      id: cfg.id,
      user_id: `seed-${cfg.owner.toLowerCase()}`,
      url: cfg.url,
      substrate: cfg.substrate,
      title: cfg.title,
      topic: cfg.topic,
      target_audience: cfg.target_audience ?? null,
      current_stage: "DRAFT",
      current_iteration: 0,
      notes: cfg.notes ?? null,
      created_at: t0,
      updated_at: t0,
    },
  });
  const recs = drafts.map((d) => recommendationRow(auc, d, 0, tRec));
  for (const r of recs) events.push({ type: "RECOMMENDATION_CREATED", recommendation: r });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "DRAFT", "RECOMMENDED", 0, { count: recs.length }, tRec) });

  // Apply the q-shaped-subhead-lattice rec — chapter timestamps get the most leverage on YouTube.
  const chosen = recs.find((r) => r.triz_principle === "q-shaped-subhead-lattice");
  const artifact = adapter.applyArtifact(chosen, auc);
  events.push({ type: "APPLICATION_CREATED", application: applicationRow(cfg, chosen, 0, artifact, tApp) });
  events.push({ type: "STAGE_TRANSITION", event: eventRow(cfg, "RECOMMENDED", "APPLIED", 0, { recommendation_id: chosen.id, artifact_kind: artifact.artifact_kind }, tApp) });
  return events;
}

async function writeStateJsonl(dir, events) {
  const out = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const filePath = join(ROOT, "data/use-cases", dir, "state.jsonl");
  if (isDryRun) {
    console.log(`--- ${filePath} (${events.length} events) ---`);
    console.log(out);
    return;
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, out, "utf8");
  console.log(`wrote ${filePath} (${events.length} events)`);
}

async function main() {
  const cfgs = await Promise.all(SEED_DIRS.map((d) => loadConfig(d)));
  const builders = {
    "u1-technektar-dev": buildEventsForU1,
    "u2-technektar-substack-context-window": buildEventsForU2,
    "u3-youtube-fM2hpqPx8zg": buildEventsForU3,
  };
  for (let i = 0; i < SEED_DIRS.length; i += 1) {
    const dir = SEED_DIRS[i];
    const cfg = cfgs[i];
    const adapter = await loadAdapter(cfg.substrate);
    const events = await builders[dir](cfg, adapter);
    await writeStateJsonl(dir, events);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
