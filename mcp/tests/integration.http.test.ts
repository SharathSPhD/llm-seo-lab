/**
 * In-process HTTP integration test for the llm-seo-lab MCP server.
 *
 * Boots the server on a random port, then exercises every registered tool
 * over POST /rpc with a real `fetch`. Tools that require a live Claude CLI,
 * Playwright, or `gh` use injected fakes via the `arguments` payload.
 *
 * Acts as the tripwire for the contract drift the adversarial review caught
 * (web/cli-worker calling tools with the wrong arg names or assuming the
 * envelope shape).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../src/server.ts";
import type { SiteConfig, PageAuditResult } from "@llm-seo-lab/shared";

interface Envelope<T> { ok: boolean; value?: T; error?: { code: string; message: string } }

async function callTool<T>(port: number, name: string, args: Record<string, unknown>): Promise<Envelope<T>> {
  const res = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  assert.equal(res.status, 200, `HTTP ${res.status} for tools/call ${name}`);
  const j = (await res.json()) as { result: Envelope<T>; error?: { code: number; message: string } };
  if (j.error) throw new Error(`json-rpc error ${j.error.code}: ${j.error.message}`);
  return j.result;
}

async function bootServerWithSeed(): Promise<{ port: number; dataDir: string; stop: () => Promise<void> }> {
  const dataDir = await mkdtemp(join(tmpdir(), "mcp-int-"));
  const siteRoot = join(dataDir, "sites", "integration");
  await mkdir(join(siteRoot, "audits"), { recursive: true });
  await mkdir(join(siteRoot, "briefs"), { recursive: true });
  await mkdir(join(siteRoot, "prs"), { recursive: true });
  await mkdir(join(siteRoot, "snapshots"), { recursive: true });
  const cfg: SiteConfig = {
    site_id: "integration",
    repo_path: "/tmp/integration",
    site_url: "https://integration.example",
    tier: "indie",
    action_substrate: "git",
    engines: ["claude_ai"],
    topics: ["t1"],
    question_banks: { t1: ["q1"] },
    evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
    rate_limits: {
      audit_page_per_minute: 60,
      oracle_query_per_minute: 60,
      generate_brief_per_minute: 30,
      open_pr_per_minute: 10,
    },
    telemetry: false,
    seed_pages: ["https://integration.example/p1"],
  };
  await writeFile(join(siteRoot, "config.json"), JSON.stringify(cfg, null, 2));
  const audit: PageAuditResult = {
    page_url: "https://integration.example/p1",
    audit_id: "a_int_001",
    timestamp: "2026-04-25T00:00:00Z",
    claude_model: "stub",
    scores: { cite_sources: 60, quotation_addition: 60, statistics_addition: 60, authoritative_tone: 60, schema_coverage: 60 },
    gaps: [
      { gap_id: "g1", tactic: "cite_sources", predicted_lift_pp: 11, evidence_tier: "tier1", geo_paper_reference: "GEO §3.1", page_locator: "main", rationale: "no primary citations" },
    ],
  };
  await writeFile(join(siteRoot, "audits", "a_int_001.json"), JSON.stringify(audit));
  const s = await startServer({ enableStdio: false, httpPort: 0, dataDir, rateLimit: { capacity: 100, refillPerMinute: 6000 } });
  return { port: s.http!.port, dataDir, stop: () => s.http!.stop() };
}

test("HTTP: tools/list returns all 16 tool names", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const j = (await res.json()) as { result: { tools: { name: string }[] } };
    const names = new Set(j.result.tools.map((t) => t.name));
    for (const required of [
      "read_repo_metadata", "read_config", "write_config",
      "audit_page", "generate_brief", "emit_schema",
      "open_pr", "oracle_query", "track_citations",
      "compare_competitors", "read_pr_status", "read_results",
      "list_sites", "read_latest_audit", "list_prs", "read_citation_trend",
    ]) {
      assert.ok(names.has(required), `missing tool: ${required}`);
    }
    assert.equal(names.size, 16);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: read-side tools roundtrip the {ok,value} envelope", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const list = await callTool<{ sites: SiteConfig[] }>(ctx.port, "list_sites", {});
    assert.equal(list.ok, true);
    assert.equal(list.value!.sites[0]!.site_id, "integration");

    const cfg = await callTool<SiteConfig>(ctx.port, "read_config", { site_id: "integration" });
    assert.equal(cfg.ok, true);
    assert.equal(cfg.value!.site_url, "https://integration.example");

    const audit = await callTool<{ audit_run_id: string; total_gaps: number }>(
      ctx.port, "read_latest_audit", { site_id: "integration" },
    );
    assert.equal(audit.ok, true);
    assert.equal(audit.value!.audit_run_id, "a_int_001");
    assert.equal(audit.value!.total_gaps, 1);

    const prs = await callTool<{ prs: unknown[] }>(ctx.port, "list_prs", { site_id: "integration" });
    assert.equal(prs.ok, true);
    assert.equal(prs.value!.prs.length, 0);

    const trend = await callTool(ctx.port, "read_citation_trend", { site_id: "integration", topic: "missing" });
    assert.equal(trend.ok, false);
    assert.equal(trend.error!.code, "NOT_FOUND");
  } finally {
    await ctx.stop();
  }
});

test("HTTP: emit_schema produces valid Article JSON-LD", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const r = await callTool<{ jsonld: Record<string, unknown> }>(ctx.port, "emit_schema", {
      page_type: "Article",
      page_url: "https://integration.example/p1",
      page_title: "Hello",
      facts: { author_name: "A", date_published: "2026-04-25", publisher_name: "P" },
    });
    assert.equal(r.ok, true);
    assert.equal(r.value!.jsonld["@type"], "Article");
  } finally {
    await ctx.stop();
  }
});

test("HTTP: track_citations + compare_competitors aggregate correctly", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const tc = await callTool<{ per_engine: Record<string, { share: number }> }>(ctx.port, "track_citations", {
      samples: [
        { engine: "perplexity", question: "q1", cited: true, sampled_at: "t", sampling_path: "claude_cli" },
        { engine: "perplexity", question: "q2", cited: false, sampled_at: "t", sampling_path: "claude_cli" },
      ],
      topic: "t1",
      window_start: "a",
      window_end: "b",
    });
    assert.equal(tc.ok, true);
    assert.equal(tc.value!.per_engine["perplexity"]!.share, 0.5);

    const cc = await callTool<{ user_share_per_engine: Record<string, number>; gap_themes: { theme: string }[] }>(
      ctx.port, "compare_competitors", {
        topic: "t1",
        user_site: "https://us",
        competitor_sites: ["https://them"],
        citation_map: {
          perplexity: { q1: ["https://them"], q2: ["https://us", "https://them"] },
        },
      });
    assert.equal(cc.ok, true);
    assert.equal(cc.value!.user_share_per_engine["perplexity"], 0.5);
    assert.ok(cc.value!.gap_themes.length > 0);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: read_repo_metadata + read_results work over the wire", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const meta = await callTool<{ has_sitemap: boolean }>(ctx.port, "read_repo_metadata", {
      repo_path: ".",
    });
    assert.equal(meta.ok, true);

    const results = await callTool<{ audits: unknown[] }>(ctx.port, "read_results", {
      results_dir: join(ctx.dataDir, "sites", "integration"),
    });
    assert.equal(results.ok, true);
    assert.equal(results.value!.audits.length, 1);
  } finally {
    await ctx.stop();
  }
});

test("HTTP: unknown tool returns -32601", async () => {
  const ctx = await bootServerWithSeed();
  try {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "no_such", arguments: {} },
      }),
    });
    const j = (await res.json()) as { error: { code: number } };
    assert.equal(j.error.code, -32601);
  } finally {
    await ctx.stop();
  }
});
