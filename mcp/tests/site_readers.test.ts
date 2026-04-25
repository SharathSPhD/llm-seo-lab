import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listSites,
  readConfig,
  readLatestAudit,
  listPrs,
  readCitationTrend,
} from "../src/tools/index.ts";
import type { ToolContext } from "../src/types.ts";
import { ok } from "@llm-seo-lab/shared";
import type {
  SiteConfig,
  PageAuditResult,
  PrSummary,
  CitationShareSnapshot,
} from "@llm-seo-lab/shared";

function makeCtx(dataDir: string): ToolContext {
  return {
    workers: {
      claude: { async invoke() { return ok(""); }, stats() { return { inflight: 0, queue_depth: 0 }; } },
      playwright: { async query() { return ok({ cited_urls: [] }); }, sessionsAlive() { return 0; } },
      fs: { watch: () => () => {} },
    },
    rateLimit: { async take() { return ok(undefined); } },
    now: () => new Date("2026-04-25T12:00:00Z"),
    cwd: process.cwd(),
    dataDir,
  };
}

const SITE_FIXTURE: SiteConfig = {
  site_id: "demo",
  repo_path: "/tmp/demo",
  site_url: "https://demo.example",
  tier: "indie",
  action_substrate: "git",
  engines: ["claude_ai", "perplexity"],
  topics: ["topic-a"],
  question_banks: { "topic-a": ["q1", "q2"] },
  evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
  rate_limits: {
    audit_page_per_minute: 10,
    oracle_query_per_minute: 10,
    generate_brief_per_minute: 5,
    open_pr_per_minute: 2,
  },
  telemetry: false,
  seed_pages: ["https://demo.example/p1"],
};

async function seedDataDir(dataDir: string): Promise<void> {
  const root = join(dataDir, "sites", "demo");
  await mkdir(join(root, "audits"), { recursive: true });
  await mkdir(join(root, "briefs"), { recursive: true });
  await mkdir(join(root, "prs"), { recursive: true });
  await mkdir(join(root, "snapshots"), { recursive: true });
  await writeFile(join(root, "config.json"), JSON.stringify(SITE_FIXTURE, null, 2));
}

test("list_sites returns the seeded SiteConfig and empties cleanly", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-sites-"));
  await seedDataDir(dataDir);
  const ctx = makeCtx(dataDir);
  const r = await listSites.handler({}, ctx);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.sites.length, 1);
    assert.equal(r.value.sites[0]!.site_id, "demo");
  }

  const empty = await mkdtemp(join(tmpdir(), "ll-empty-"));
  const r2 = await listSites.handler({}, makeCtx(empty));
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.value.sites.length, 0);
});

test("read_config({site_id}) resolves against dataDir", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-cfg-"));
  await seedDataDir(dataDir);
  const r = await readConfig.handler({ site_id: "demo" }, makeCtx(dataDir));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.site_url, "https://demo.example");
});

test("read_config errors when neither site_id nor config_path supplied", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-cfg-"));
  const r = await readConfig.handler({}, makeCtx(dataDir));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "INVALID_INPUT");
});

test("read_latest_audit picks the newest timestamp and aggregates gaps", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-audit-"));
  await seedDataDir(dataDir);
  const auditsDir = join(dataDir, "sites", "demo", "audits");
  const older: PageAuditResult = {
    page_url: "https://demo.example/p1",
    audit_id: "a_001",
    timestamp: "2026-04-20T00:00:00Z",
    claude_model: "stub",
    scores: { cite_sources: 50, quotation_addition: 50, statistics_addition: 50, authoritative_tone: 50, schema_coverage: 50 },
    gaps: [
      { gap_id: "g0", tactic: "cite_sources", predicted_lift_pp: 4, evidence_tier: "tier1", geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "older" },
    ],
  };
  const newer: PageAuditResult = {
    page_url: "https://demo.example/p1",
    audit_id: "a_002",
    timestamp: "2026-04-25T00:00:00Z",
    claude_model: "stub",
    scores: { cite_sources: 60, quotation_addition: 60, statistics_addition: 60, authoritative_tone: 60, schema_coverage: 60 },
    gaps: [
      { gap_id: "g1", tactic: "cite_sources", predicted_lift_pp: 12, evidence_tier: "tier1", geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "missing primary citations" },
      { gap_id: "g2", tactic: "quotation_addition", predicted_lift_pp: 8, evidence_tier: "tier1", geo_paper_reference: "GEO §3.2", page_locator: "main", rationale: "no expert quotes" },
    ],
  };
  await writeFile(join(auditsDir, "a_001.json"), JSON.stringify(older));
  await writeFile(join(auditsDir, "a_002.json"), JSON.stringify(newer));

  const r = await readLatestAudit.handler({ site_id: "demo" }, makeCtx(dataDir));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.audit_run_id, "a_002");
    assert.equal(r.value.total_gaps, 2);
    assert.equal(r.value.recent_gaps[0]!.gap_id, "g1");
    assert.ok(r.value.predicted_aggregate_lift_pp >= 20);
  }
});

test("read_latest_audit returns NOT_FOUND when no audits exist", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-audit-"));
  await seedDataDir(dataDir);
  const r = await readLatestAudit.handler({ site_id: "demo" }, makeCtx(dataDir));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "NOT_FOUND");
});

test("list_prs returns prs sorted newest-first", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-prs-"));
  await seedDataDir(dataDir);
  const dir = join(dataDir, "sites", "demo", "prs");
  const oldPr: PrSummary = {
    pr_number: 1, pr_url: "https://gh/o/r/pull/1", branch: "aeo-fix/1",
    state: "merged", brief_id: "b1", opened_at: "2026-04-20T00:00:00Z",
    merged_at: "2026-04-21T00:00:00Z", age_days: 5, labels: ["aeo-loop"],
  };
  const newPr: PrSummary = {
    pr_number: 2, pr_url: "https://gh/o/r/pull/2", branch: "aeo-fix/2",
    state: "open", brief_id: "b2", opened_at: "2026-04-24T00:00:00Z",
    age_days: 1, labels: ["aeo-loop", "needs-review"],
  };
  await writeFile(join(dir, "1.json"), JSON.stringify(oldPr));
  await writeFile(join(dir, "2.json"), JSON.stringify(newPr));
  const r = await listPrs.handler({ site_id: "demo" }, makeCtx(dataDir));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.prs.length, 2);
    assert.equal(r.value.prs[0]!.pr_number, 2);
  }
});

test("read_citation_trend filters by topic and orders by window_end", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-trend-"));
  await seedDataDir(dataDir);
  const dir = join(dataDir, "sites", "demo", "snapshots");
  const snap1: CitationShareSnapshot = {
    topic: "topic-a",
    window_start: "2026-04-01T00:00:00Z",
    window_end: "2026-04-15T00:00:00Z",
    per_engine: { claude_ai: { share: 0.2, n_questions: 10, n_citations: 2 } },
    samples: [],
  };
  const snap2: CitationShareSnapshot = {
    topic: "topic-a",
    window_start: "2026-04-15T00:00:00Z",
    window_end: "2026-04-29T00:00:00Z",
    per_engine: { claude_ai: { share: 0.4, n_questions: 10, n_citations: 4 } },
    samples: [],
  };
  const otherTopic: CitationShareSnapshot = {
    topic: "topic-b",
    window_start: "2026-04-01T00:00:00Z",
    window_end: "2026-04-29T00:00:00Z",
    per_engine: {},
    samples: [],
  };
  await writeFile(join(dir, "1.json"), JSON.stringify(snap1));
  await writeFile(join(dir, "2.json"), JSON.stringify(snap2));
  await writeFile(join(dir, "other.json"), JSON.stringify(otherTopic));

  const r = await readCitationTrend.handler({ site_id: "demo", topic: "topic-a" }, makeCtx(dataDir));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.points.length, 2);
    assert.equal(r.value.points[0]!.date, "2026-04-15T00:00:00Z");
    assert.equal(r.value.points[1]!.date, "2026-04-29T00:00:00Z");
    assert.equal(r.value.latest.per_engine.claude_ai!.share, 0.4);
  }
});

test("read_citation_trend returns NOT_FOUND on missing topic", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-trend-"));
  await seedDataDir(dataDir);
  const r = await readCitationTrend.handler({ site_id: "demo", topic: "nope" }, makeCtx(dataDir));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "NOT_FOUND");
});

test("list_prs returns empty array when prs/ is missing", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "ll-prs-empty-"));
  const r = await listPrs.handler({ site_id: "ghost" }, makeCtx(dataDir));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.prs.length, 0);
});
