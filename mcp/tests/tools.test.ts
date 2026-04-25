import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emitSchema,
  trackCitations,
  compareCompetitors,
  readRepoMetadata,
  readConfig,
  writeConfig,
  oracleQuery,
  auditPage,
  generateBrief,
  openPr,
  readPrStatus,
  readResults,
} from "../src/tools/index.ts";
import type { ToolContext } from "../src/types.ts";
import { ok } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workers: {
      claude: {
        async invoke(_p) { return ok("```json\n{\"audit_id\":\"a_x\",\"page_url\":\"u\",\"timestamp\":\"t\",\"claude_model\":\"stub\",\"scores\":{\"cite_sources\":80,\"quotation_addition\":70,\"statistics_addition\":75,\"authoritative_tone\":80,\"schema_coverage\":90},\"gaps\":[]}\n```"); },
        stats() { return { inflight: 0, queue_depth: 0 }; },
      },
      playwright: {
        async query() { return ok({ cited_urls: ["https://example.com/x"] }); },
        sessionsAlive() { return 0; },
      },
      fs: { watch: () => () => {} },
    },
    rateLimit: { async take() { return ok(undefined); } },
    now: () => new Date("2026-04-25T12:00:00Z"),
    cwd: process.cwd(),
    dataDir: `${process.cwd()}/data`,
    ...overrides,
  };
}

test("emit_schema produces valid Article JSON-LD", async () => {
  const r = await emitSchema.handler({
    page_type: "Article", page_url: "https://example.com/x", page_title: "T",
    facts: { author_name: "A", date_published: "2026-01-01", publisher_name: "P" },
  }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.jsonld["@type"], "Article");
    assert.equal(r.value.jsonld["@context"], "https://schema.org");
  }
});

test("emit_schema rejects unsupported page types", async () => {
  const r = await emitSchema.handler({
    page_type: "Cookie", page_url: "u", page_title: "t", facts: {},
  }, makeCtx());
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "INVALID_INPUT");
});

test("track_citations aggregates per-engine share", async () => {
  const r = await trackCitations.handler({
    samples: [
      { engine: "perplexity", question: "q1", cited: true, sampled_at: "t", sampling_path: "claude_cli" },
      { engine: "perplexity", question: "q2", cited: false, sampled_at: "t", sampling_path: "claude_cli" },
      { engine: "chatgpt", question: "q1", cited: true, sampled_at: "t", sampling_path: "claude_cli" },
    ],
    topic: "T", window_start: "a", window_end: "b",
  }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.per_engine.perplexity!.share, 0.5);
    assert.equal(r.value.per_engine.chatgpt!.share, 1);
  }
});

test("compare_competitors ranks gap themes", async () => {
  const r = await compareCompetitors.handler({
    topic: "T",
    user_site: "https://my.site",
    competitor_sites: ["https://c1.site"],
    citation_map: {
      perplexity: {
        q1: ["https://c1.site"],
        q2: ["https://my.site", "https://c1.site"],
      },
      chatgpt: {
        q1: ["https://c1.site"],
        q2: ["https://c1.site"],
      },
    },
  }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.user_share_per_engine["perplexity"], 0.5);
    assert.ok(r.value.gap_themes.length > 0);
    assert.equal(r.value.gap_themes[0]!.theme, "q1");
  }
});

test("read_repo_metadata detects git + sitemap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repo-"));
  await mkdir(join(dir, ".git"));
  await writeFile(join(dir, "sitemap.xml"), "<urlset></urlset>");
  await writeFile(join(dir, "index.html"), "<html></html>");
  const r = await readRepoMetadata.handler({ repo_path: dir }, makeCtx({ cwd: "/" }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.repo_type, "git");
    assert.equal(r.value.has_sitemap, true);
    assert.ok(r.value.page_count_estimate >= 1);
  }
});

test("read_repo_metadata errors on missing path", async () => {
  const r = await readRepoMetadata.handler({ repo_path: "/nonexistent/x/y/z" }, makeCtx({ cwd: "/" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "NOT_FOUND");
});

test("write_config + read_config round-trip", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cfg-"));
  const p = join(dir, "site.json");
  const cfg = {
    site_id: "s1", repo_path: "/x", site_url: "https://x", tier: "indie" as const,
    action_substrate: "git" as const, engines: ["claude_ai"] as const,
    topics: [], question_banks: {},
    evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
    rate_limits: { audit_page_per_minute: 10, oracle_query_per_minute: 10, generate_brief_per_minute: 5, open_pr_per_minute: 2 },
    telemetry: false,
  };
  const w = await writeConfig.handler({ config_path: p, config: cfg as never }, makeCtx());
  assert.equal(w.ok, true);
  const r = await readConfig.handler({ config_path: p }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.site_id, "s1");
});

test("audit_page parses the Claude JSON block", async () => {
  const ctx = makeCtx();
  const r = await auditPage.handler({ page_url: "https://x", page_html: "<html></html>" }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.scores.cite_sources, 80);
});

test("audit_page falls back to a deterministic stub when JSON block is absent", async () => {
  /**
   * Loop continuity: when Claude does not return a fenced JSON block we
   * must produce a stub `PageAuditResult` (clearly marked
   * `claude_model: "fallback-stub"`) rather than failing the whole loop.
   * The strict path is still covered by the unit test on
   * `parseAuditFromClaude` and by integration tests against the real CLI.
   */
  const ctx = makeCtx({
    workers: {
      ...makeCtx().workers,
      claude: { async invoke() { return ok("no json here"); }, stats() { return { inflight: 0, queue_depth: 0 }; } },
    },
  });
  const r = await auditPage.handler({ page_url: "https://x", page_html: "<html></html>" }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.claude_model, "fallback-stub");
    assert.ok(r.value.gaps.length >= 1, "stub audit should surface at least one Tier-1 gap");
    assert.ok(r.value.gaps.every((g) => g.evidence_tier === "tier1"));
  }
});

test("generate_brief falls back to deterministic stub when Claude returns no JSON", async () => {
  const ctx = makeCtx({
    workers: {
      ...makeCtx().workers,
      claude: { async invoke() { return ok("(no json block)"); }, stats() { return { inflight: 0, queue_depth: 0 }; } },
    },
  });
  const r = await generateBrief.handler({
    gap: { gap_id: "g1", tactic: "cite_sources", predicted_lift_pp: 12, evidence_tier: "tier1", geo_paper_reference: "ref", page_locator: "p", rationale: "r" },
    page_url: "https://x", page_html: "<p>x</p>", repo_path: "/r",
  }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.tactic, "cite_sources");
});

test("oracle_query uses claude path when JSON parses", async () => {
  const ctx = makeCtx({
    workers: {
      ...makeCtx().workers,
      claude: { async invoke() { return ok('{"cited": true, "snippet": "s"}'); }, stats() { return { inflight: 0, queue_depth: 0 }; } },
    },
  });
  const r = await oracleQuery.handler({ engine: "claude_ai", question: "q", site_url: "https://x" }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.cited, true);
    assert.equal(r.value.sampling_path, "claude_cli");
  }
});

test("oracle_query falls back to playwright when claude has no JSON", async () => {
  const ctx = makeCtx({
    workers: {
      ...makeCtx().workers,
      claude: { async invoke() { return ok("nope"); }, stats() { return { inflight: 0, queue_depth: 0 }; } },
      playwright: {
        async query() { return ok({ cited_urls: ["https://x"], snippet: "snippet" }); },
        sessionsAlive() { return 1; },
      },
    },
  });
  const r = await oracleQuery.handler({ engine: "perplexity", question: "q", site_url: "https://x" }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.sampling_path, "playwright");
    assert.equal(r.value.cited, true);
  }
});

test("open_pr extracts PR number from gh stdout", async () => {
  let captured: string[] = [];
  const fakeGh = async (args: string[]): Promise<{ stdout: string; code: number }> => {
    captured = args;
    return { stdout: "https://github.com/u/r/pull/42\n", code: 0 };
  };
  const r = await openPr.handler({
    repo_path: "u/r", branch: "feature/aeo-001", brief_id: "b1",
    pr_title: "x", pr_body: "y", ghCli: fakeGh,
  }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.pr_number, 42);
    assert.equal(r.value.state, "open");
  }
  assert.ok(captured.includes("--title"));
});

test("open_pr live mode: clones, commits, pushes, then opens PR", async () => {
  /**
   * The live path is the one Phase R5 needs end-to-end. We exercise the full
   * stage sequence without touching the network by injecting fake git/gh CLIs
   * and asserting the ordered shell-call ledger. The fake `git status` returns
   * a non-empty diff so the no-op commit guard does not abort.
   */
  const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
  const fakeGit = async (args: string[], opts?: { cwd?: string }): Promise<{ stdout: string; code: number }> => {
    calls.push(opts?.cwd ? { cmd: "git", args, cwd: opts.cwd } : { cmd: "git", args });
    if (args[0] === "status") return { stdout: " M docs/aeo/brief.md\n", code: 0 };
    return { stdout: "", code: 0 };
  };
  const fakeGh = async (args: string[], opts?: { cwd?: string }): Promise<{ stdout: string; code: number }> => {
    calls.push(opts?.cwd ? { cmd: "gh", args, cwd: opts.cwd } : { cmd: "gh", args });
    return { stdout: "https://github.com/SharathSPhD/sharathsphd.github.io/pull/77\n", code: 0 };
  };

  const r = await openPr.handler({
    repo_path: "SharathSPhD/sharathsphd.github.io",
    branch: "aeo/brief-007",
    brief_id: "b007",
    pr_title: "AEO: lift FAQ structured data on /about",
    pr_body: "body",
    files: [{ path: "docs/aeo/brief.md", content: "# Brief\n" }],
    gitCli: fakeGit,
    ghCli: fakeGh,
  }, makeCtx());

  assert.equal(r.ok, true, JSON.stringify(r));
  if (r.ok) {
    assert.equal(r.value.pr_number, 77);
    assert.match(r.value.pr_url, /\/pull\/77/);
  }

  const stages = calls.map((c) => `${c.cmd} ${c.args[0]}`);
  assert.deepEqual(stages, [
    "git clone",
    "git checkout",
    "git add",
    "git status",
    "git -c",
    "git push",
    "gh pr",
  ]);

  const cloneCall = calls[0]!;
  assert.ok(cloneCall.args.includes("https://github.com/SharathSPhD/sharathsphd.github.io.git"));
  assert.ok(cloneCall.args.includes("--branch"));
  assert.ok(cloneCall.args.includes("main"));

  const pushCall = calls.find((c) => c.cmd === "git" && c.args[0] === "push")!;
  assert.deepEqual(pushCall.args, ["push", "-u", "origin", "aeo/brief-007"]);

  const ghCall = calls.find((c) => c.cmd === "gh")!;
  assert.ok(ghCall.args.includes("--head"));
  assert.ok(ghCall.args.includes("aeo/brief-007"));
  assert.ok(ghCall.cwd, "gh pr create must run inside the cloned worktree");
});

test("open_pr live mode: refuses to commit when diff is empty", async () => {
  const fakeGit = async (args: string[]): Promise<{ stdout: string; code: number }> => {
    if (args[0] === "status") return { stdout: "", code: 0 };
    return { stdout: "", code: 0 };
  };
  const fakeGh = async (): Promise<{ stdout: string; code: number }> => ({
    stdout: "should not be called", code: 0,
  });

  const r = await openPr.handler({
    repo_path: "SharathSPhD/sharathsphd.github.io",
    branch: "aeo/brief-noop",
    brief_id: "b-noop",
    pr_title: "noop",
    pr_body: "noop",
    files: [{ path: "x.md", content: "y" }],
    gitCli: fakeGit,
    ghCli: fakeGh,
  }, makeCtx());

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "INVALID_INPUT");
    assert.match(r.error.message, /no file changes/);
  }
});

test("read_pr_status parses gh JSON", async () => {
  const fakeGh = async (): Promise<{ stdout: string; code: number }> => ({
    stdout: JSON.stringify({
      number: 7, url: "https://gh/pr/7", headRefName: "feature/x",
      state: "MERGED", createdAt: "2026-04-20T00:00:00Z", mergedAt: "2026-04-21T00:00:00Z",
      labels: [{ name: "aeo-loop" }],
    }),
    code: 0,
  });
  const r = await readPrStatus.handler({ repo_path: "u/r", pr_number: 7, ghCli: fakeGh }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.state, "merged");
    assert.equal(r.value.age_days, 5);
    assert.deepEqual(r.value.labels, ["aeo-loop"]);
  }
});

test("read_results returns empty bundle for empty dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "results-"));
  const r = await readResults.handler({ results_dir: dir }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.audits.length, 0);
    assert.equal(r.value.briefs.length, 0);
  }
});

test("read_results loads JSON from each subdir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "results-"));
  await mkdir(join(dir, "audits"));
  await writeFile(join(dir, "audits", "a1.json"), JSON.stringify({ audit_id: "a1" }));
  await mkdir(join(dir, "snapshots"));
  await writeFile(join(dir, "snapshots", "s1.json"), JSON.stringify({ topic: "t" }));
  const r = await readResults.handler({ results_dir: dir }, makeCtx());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.audits.length, 1);
    assert.equal(r.value.citation_snapshots.length, 1);
  }
});

test("rate-limited tools surface QUOTA_EXCEEDED", async () => {
  const failing: Result<void> = { ok: false, error: { code: "QUOTA_EXCEEDED", message: "x", retry_after_seconds: 30, actionable_next_step: "wait" } };
  const ctx = makeCtx({ rateLimit: { async take() { return failing; } } });
  const r = await auditPage.handler({ page_url: "https://x" }, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "QUOTA_EXCEEDED");
});
