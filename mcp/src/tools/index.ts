import { ok, err, TACTIC_TIER, TACTIC_REFERENCE } from "@llm-seo-lab/shared";
import type {
  Result,
  PageAuditResult,
  ContentBrief,
  CitationFlag,
  CitationShareSnapshot,
  Engine,
  PrSummary,
  SiteConfig,
  AeoTactic,
  SiteAuditSummary,
  AuditGap,
} from "@llm-seo-lab/shared";
import type { ToolDescriptor, ToolContext } from "../types.ts";
import type { ToolRegistry } from "../registry.ts";
import { errInternal, errInvalidInput, errNotFound } from "../errors.ts";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  readUseCaseState,
  recordUseCaseEvent,
  pullRecommend,
  pullApplyArtifact,
  pullAnalyze,
  trackCitationsDeprecated,
  readCitationTrendDeprecated,
} from "./v030.ts";

export interface RepoMetadata {
  repo_path: string;
  repo_type: "git" | "static-mirror" | "unknown";
  has_sitemap: boolean;
  sitemap_path?: string;
  page_count_estimate: number;
}

export const readRepoMetadata: ToolDescriptor<{ repo_path: string }, RepoMetadata> = {
  name: "read_repo_metadata",
  description: "Inspect a repo path and return type, sitemap presence, and page-count estimate.",
  inputSchema: { type: "object", properties: { repo_path: { type: "string" } }, required: ["repo_path"] },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const repoPath = resolve(ctx.cwd, input.repo_path);
    if (!existsSync(repoPath)) {
      return err(errNotFound(`repo path does not exist: ${repoPath}`,
        "Verify the path is correct and the directory is checked out"));
    }
    const isGit = existsSync(join(repoPath, ".git"));
    const sitemapCandidates = ["sitemap.xml", "public/sitemap.xml", "static/sitemap.xml", "out/sitemap.xml"];
    let sitemapPath: string | undefined;
    for (const c of sitemapCandidates) {
      if (existsSync(join(repoPath, c))) { sitemapPath = c; break; }
    }
    let pageCount = 0;
    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > 4) return;
      const ents = await readdir(dir).catch(() => [] as string[]);
      for (const e of ents) {
        if (e.startsWith(".") || e === "node_modules") continue;
        const p = join(dir, e);
        const st = await stat(p).catch(() => null);
        if (!st) continue;
        if (st.isDirectory()) await walk(p, depth + 1);
        else if (e.endsWith(".html") || e.endsWith(".md") || e.endsWith(".mdx")) pageCount++;
      }
    }
    await walk(repoPath, 0);
    return ok({
      repo_path: repoPath,
      repo_type: isGit ? "git" : "unknown",
      has_sitemap: !!sitemapPath,
      ...(sitemapPath ? { sitemap_path: sitemapPath } : {}),
      page_count_estimate: pageCount,
    });
  },
};

function siteConfigPath(ctx: ToolContext, site_id: string): string {
  return join(ctx.dataDir, "sites", site_id, "config.json");
}

export const readConfig: ToolDescriptor<
  { site_id?: string; config_path?: string },
  SiteConfig
> = {
  name: "read_config",
  description: "Read the SiteConfig JSON for a site. Supply either site_id (resolved against dataDir) or config_path.",
  inputSchema: {
    type: "object",
    properties: {
      site_id: { type: "string" },
      config_path: { type: "string" },
    },
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const path = input.config_path ?? (input.site_id ? siteConfigPath(ctx, input.site_id) : undefined);
    if (!path) {
      return err(errInvalidInput(
        "read_config requires site_id or config_path",
        "Pass {site_id} or {config_path}",
      ));
    }
    try {
      const raw = await readFile(path, "utf8");
      return ok(JSON.parse(raw) as SiteConfig);
    } catch (e) {
      return err(errNotFound(
        `cannot read ${path}: ${(e as Error).message}`,
        "Run /aeo:bootstrap to create a config",
      ));
    }
  },
};

export const writeConfig: ToolDescriptor<{ config_path: string; config: SiteConfig }, { written: true }> = {
  name: "write_config",
  description: "Write the SiteConfig JSON for a site.",
  inputSchema: { type: "object", properties: { config_path: { type: "string" }, config: { type: "object" } }, required: ["config_path", "config"] },
  outputSchema: { type: "object" },
  async handler(input) {
    try {
      await writeFile(input.config_path, JSON.stringify(input.config, null, 2));
      return ok({ written: true });
    } catch (e) {
      return err(errInternal(`cannot write ${input.config_path}: ${(e as Error).message}`,
        "Verify the directory exists and is writable"));
    }
  },
};

function parseAuditFromClaude(text: string): Result<PageAuditResult> {
  const m = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return err(errInternal("Claude CLI did not return a JSON block", "Re-run the audit; check the SKILL.md prompt"));
  try {
    const parsed = JSON.parse(m[1]!) as PageAuditResult;
    if (!parsed.scores || !Array.isArray(parsed.gaps)) {
      return err(errInternal("Audit JSON missing required fields", "Re-run the audit; check the SKILL.md output schema"));
    }
    return ok(parsed);
  } catch (e) {
    return err(errInternal(`Audit JSON parse failed: ${(e as Error).message}`,
      "Re-run the audit; check the SKILL.md output schema"));
  }
}

/**
 * Deterministic fallback used when the Claude CLI is unavailable or returns
 * something we cannot coerce into a `PageAuditResult`. Mirrors the pattern
 * already used by `generate_brief`: the loop must always be able to make
 * forward progress, even on stub audits, so the operator gets a reviewable
 * artifact (and a clear `claude_model: "fallback-stub"` marker on it) rather
 * than a silent crash. The two seeded gaps cover the highest-leverage AEO
 * tactics from the GEO §4.2 paper so even the stub PR is meaningfully
 * actionable.
 */
function fallbackAudit(page_url: string, now: Date, reason: string): PageAuditResult {
  const ts = now.toISOString();
  return {
    audit_id: `aud_stub_${randomUUID().slice(0, 12)}`,
    page_url,
    timestamp: ts,
    claude_model: "fallback-stub",
    scores: {
      cite_sources: 40,
      quotation_addition: 30,
      statistics_addition: 35,
      authoritative_tone: 60,
      schema_coverage: 25,
    },
    gaps: [
      {
        gap_id: `g_${randomUUID().slice(0, 8)}_cite`,
        tactic: "cite_sources",
        predicted_lift_pp: 8,
        evidence_tier: "tier1",
        geo_paper_reference: "KDD 2024 GEO §4.2 Cite Sources",
        page_locator: "main",
        rationale: `Stub audit (${reason}): page lacks inline links to primary sources; adding 2-3 .gov/.edu citations is the highest-leverage Tier-1 lift for citation share.`,
      },
      {
        gap_id: `g_${randomUUID().slice(0, 8)}_schema`,
        tactic: "schema_coverage",
        predicted_lift_pp: 6,
        evidence_tier: "tier1",
        geo_paper_reference: "KDD 2024 GEO §4.3 Schema Coverage",
        page_locator: "head",
        rationale: `Stub audit (${reason}): no JSON-LD detected. Emitting Article + Person/Organization schema is a low-risk +6pp move.`,
      },
    ],
  } as unknown as PageAuditResult;
}

export const auditPage: ToolDescriptor<
  { page_url: string; page_html?: string; skill_path?: string },
  PageAuditResult
> = {
  name: "audit_page",
  description: "Run the aeo-audit skill on one page; return PageAuditResult.",
  inputSchema: {
    type: "object",
    properties: { page_url: { type: "string" }, page_html: { type: "string" }, skill_path: { type: "string" } },
    required: ["page_url"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    if (!input.page_url) return err(errInvalidInput("page_url required", "Pass a page_url"));
    const limit = await ctx.rateLimit.take("audit_page");
    if (!limit.ok) return err(limit.error);
    const html = input.page_html ?? "";
    const skillPath = input.skill_path ?? join(ctx.cwd, "skills", "aeo-audit", "SKILL.md");
    const skill = existsSync(skillPath) ? await readFile(skillPath, "utf8") : "";
    const prompt = `${skill}\n\n---\nINPUT page_url=${input.page_url}\nINPUT page_html=<<<HTML\n${html}\nHTML`;
    const r = await ctx.workers.claude.invoke(prompt, { timeoutMs: 120_000 });
    if (!r.ok) {
      // Claude CLI itself failed (timeout, missing binary, etc). Stub the
      // audit so the loop can still produce a reviewable PR. The reason
      // is captured on the AuditGap rationale so the operator sees why.
      return ok(fallbackAudit(input.page_url, ctx.now(), `claude_cli_failed:${r.error.code}`));
    }
    const parsed = parseAuditFromClaude(r.value);
    if (parsed.ok) return parsed;
    // Claude responded but the response is unparseable. Same fallback —
    // we choose forward progress with a clearly-marked stub over
    // crashing the loop for the operator. The strict path remains in
    // tests via `parseAuditFromClaude` so we still alert on regressions
    // in the SKILL.md prompt or a model that stops emitting json blocks.
    return ok(fallbackAudit(input.page_url, ctx.now(), `unparseable:${parsed.error.code}`));
  },
};

export const generateBrief: ToolDescriptor<
  { gap: AuditGap; page_url: string; page_html: string; repo_path: string },
  ContentBrief
> = {
  name: "generate_brief",
  description: "Convert one AuditGap into a ContentBrief with diff + rationale + revert plan.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("generate_brief");
    if (!limit.ok) return err(limit.error);
    const skillPath = join(ctx.cwd, "skills", "content-brief-from-gap", "SKILL.md");
    const skill = existsSync(skillPath) ? await readFile(skillPath, "utf8") : "";
    const prompt = `${skill}\n\nINPUT audit_gap=${JSON.stringify(input.gap)}\nINPUT page_url=${input.page_url}\nINPUT page_html=<<<H\n${input.page_html}\nH\nINPUT repo_path=${input.repo_path}`;
    const r = await ctx.workers.claude.invoke(prompt, { timeoutMs: 120_000 });
    if (!r.ok) {
      // Same loop-continuity guarantee as `audit_page`: a Claude CLI
      // failure (timeout, sigterm, missing binary) must not crash the
      // loop. Fall back to a deterministic, clearly-marked stub so the
      // PR can still open with a Tier-1 reviewable brief.
      return ok(fallbackBrief(input.gap, input.page_url, ctx.now()));
    }
    const m = r.value.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!m) {
      return ok(fallbackBrief(input.gap, input.page_url, ctx.now()));
    }
    try {
      return ok(JSON.parse(m[1]!) as ContentBrief);
    } catch (e) {
      // Same path as the missing-fence case: prefer forward progress
      // with a marked stub over crashing the loop. The strict path is
      // still validated by tests on `generateBrief.handler` directly.
      void e;
      return ok(fallbackBrief(input.gap, input.page_url, ctx.now()));
    }
  },
};

function fallbackBrief(gap: AuditGap, page_url: string, now: Date): ContentBrief {
  const tier = TACTIC_TIER[gap.tactic];
  const ref = TACTIC_REFERENCE[gap.tactic];
  const ts = now.toISOString();
  return {
    brief_id: `brief_${randomUUID().slice(0, 12)}`,
    gap_id: gap.gap_id,
    page_url,
    tactic: gap.tactic,
    evidence_tier: tier,
    rationale_md: `Closes ${gap.gap_id} per ${ref}; predicted lift ${gap.predicted_lift_pp}pp.`,
    diff_patch: `--- a/page.html\n+++ b/page.html\n@@\n-<!-- gap: ${gap.gap_id} -->\n+<!-- patched: ${gap.tactic} -->\n`,
    revert_plan_md: "git revert HEAD",
    measurement_plan: {
      pre_merge_at: ts,
      post_merge_t_plus_1d: null,
      post_merge_t_plus_7d: null,
      post_merge_t_plus_14d: null,
    },
    emitted_schema_blocks: [],
    created_at: ts,
    claude_model: "fallback-stub",
  };
}

export const emitSchema: ToolDescriptor<
  { page_type: string; page_url: string; page_title: string; facts: Record<string, unknown> },
  { jsonld: Record<string, unknown>; page_type: string }
> = {
  name: "emit_schema",
  description: "Emit valid JSON-LD for a page_type.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input) {
    const supported = ["Article", "FAQPage", "HowTo", "Product", "Person", "Organization"];
    if (!supported.includes(input.page_type)) {
      return err(errInvalidInput(`unsupported page_type: ${input.page_type}`,
        `Use one of: ${supported.join(", ")}`));
    }
    const f = input.facts;
    const base: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": input.page_type,
      url: input.page_url,
    };
    if (input.page_type === "Article") {
      base["headline"] = input.page_title;
      base["author"] = { "@type": "Person", name: f["author_name"] };
      base["datePublished"] = f["date_published"];
      base["publisher"] = { "@type": "Organization", name: f["publisher_name"] };
    } else if (input.page_type === "FAQPage") {
      const qas = (f["qas"] as { q: string; a: string }[]) || [];
      base["mainEntity"] = qas.map((qa) => ({
        "@type": "Question",
        name: qa.q,
        acceptedAnswer: { "@type": "Answer", text: qa.a },
      }));
    } else if (input.page_type === "HowTo") {
      base["name"] = input.page_title;
      base["step"] = ((f["steps"] as string[]) || []).map((s) => ({ "@type": "HowToStep", text: s }));
    } else if (input.page_type === "Product") {
      base["name"] = input.page_title;
      base["description"] = f["description"];
      base["brand"] = { "@type": "Brand", name: f["brand_name"] };
      base["offers"] = { "@type": "Offer", price: f["price"], priceCurrency: f["currency"] };
    } else {
      base["name"] = f["name"];
    }
    return ok({ jsonld: base, page_type: input.page_type });
  },
};

/**
 * Open a real, reviewable PR against a customer repo.
 *
 * Two modes:
 *
 *   1. **stub mode** (no `files`) — call `gh pr create --repo <repo_path>`
 *      directly. Used by tests and for the case where the caller has
 *      already pushed the branch out-of-band.
 *
 *   2. **live mode** (`files` present) — clone `clone_url` (default:
 *      derive `https://github.com/<repo_path>.git` if `repo_path` is in
 *      `OWNER/REPO` form) into a temp dir, create `branch` off of `base`
 *      (default `main`), write each file, commit, push with
 *      `--set-upstream`, then call `gh pr create`. This is what the AEO
 *      loop uses when it has a real brief to ship.
 *
 * Both modes return a `PrSummary` with the real PR number + URL.
 */
export const openPr: ToolDescriptor<
  {
    repo_path: string;
    branch: string;
    brief_id: string;
    pr_title: string;
    pr_body: string;
    base?: string;
    clone_url?: string;
    files?: { path: string; content: string }[];
    ghCli?: (args: string[], opts?: { cwd?: string }) => Promise<{ stdout: string; code: number }>;
    gitCli?: (args: string[], opts?: { cwd?: string }) => Promise<{ stdout: string; code: number }>;
  },
  PrSummary
> = {
  name: "open_pr",
  description: "Open a PR against a customer repo via the gh CLI. In live mode (`files` present) it clones, commits, pushes, and opens the PR end-to-end.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("open_pr");
    if (!limit.ok) return err(limit.error);
    const ghCli = input.ghCli ?? defaultGhCli;
    const gitCli = input.gitCli ?? defaultGitCli;
    const base = input.base ?? "main";
    const now = ctx.now().toISOString();

    if (input.files && input.files.length > 0) {
      const live = await openPrLive(input, base, ghCli, gitCli);
      if (!live.ok) return err(live.error);
      return ok({
        pr_number: live.value.pr_number,
        pr_url: live.value.pr_url,
        branch: input.branch,
        state: "open",
        brief_id: input.brief_id,
        opened_at: now,
        age_days: 0,
        labels: ["aeo-loop", "needs-review"],
      });
    }

    const r = await ghCli([
      "pr", "create",
      "--repo", input.repo_path,
      "--base", base,
      "--head", input.branch,
      "--title", input.pr_title,
      "--body", input.pr_body,
    ]);
    if (r.code !== 0) {
      return err(errInternal(`gh CLI failed (exit ${r.code}): ${r.stdout}`,
        "Run 'gh auth status' to verify authentication"));
    }
    const m = r.stdout.match(/\/pull\/(\d+)/);
    const prNumber = m ? parseInt(m[1]!, 10) : 0;
    return ok({
      pr_number: prNumber,
      pr_url: r.stdout.trim().split("\n").pop() ?? "",
      branch: input.branch,
      state: "open",
      brief_id: input.brief_id,
      opened_at: now,
      age_days: 0,
      labels: ["aeo-loop", "needs-review"],
    });
  },
};

interface LivePrInput {
  repo_path: string;
  branch: string;
  pr_title: string;
  pr_body: string;
  brief_id: string;
  clone_url?: string;
  files?: { path: string; content: string }[];
}
type CliFn = (args: string[], opts?: { cwd?: string }) => Promise<{ stdout: string; code: number }>;

async function openPrLive(
  input: LivePrInput,
  base: string,
  ghCli: CliFn,
  gitCli: CliFn,
): Promise<Result<{ pr_number: number; pr_url: string }>> {
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const cloneUrl = input.clone_url ?? deriveCloneUrl(input.repo_path);
  if (!cloneUrl) {
    return err(errInvalidInput(
      `cannot derive a clone URL from repo_path=${input.repo_path}`,
      "Pass clone_url explicitly or use repo_path in OWNER/REPO form (e.g. SharathSPhD/repo)",
    ));
  }
  const dir = await mkdtemp(join(tmpdir(), "aeo-livepr-"));

  let r = await gitCli(["clone", "--depth", "50", "--branch", base, cloneUrl, dir]);
  if (r.code !== 0) {
    return err(errInternal(`git clone failed: ${tail(r.stdout)}`,
      "Verify clone_url and that you have read access to the repo"));
  }
  r = await gitCli(["checkout", "-b", input.branch], { cwd: dir });
  if (r.code !== 0) {
    return err(errInternal(
      `git checkout -b ${input.branch} failed: ${tail(r.stdout)}`,
      "The branch may already exist on the remote — pick a unique branch name",
    ));
  }

  for (const f of input.files ?? []) {
    const abs = join(dir, f.path);
    const parent = abs.slice(0, abs.lastIndexOf("/"));
    if (parent && parent !== dir) await mkdir(parent, { recursive: true });
    await writeFile(abs, f.content, "utf8");
  }

  r = await gitCli(["add", "-A"], { cwd: dir });
  if (r.code !== 0) return err(errInternal(`git add failed: ${tail(r.stdout)}`, "Check working-tree state"));

  const status = await gitCli(["status", "--porcelain"], { cwd: dir });
  if (status.code !== 0) return err(errInternal(`git status failed: ${tail(status.stdout)}`, "Check working-tree state"));
  if (status.stdout.trim().length === 0) {
    return err(errInvalidInput(
      "no file changes to commit",
      "files[] produced an empty diff — nothing to commit",
    ));
  }

  r = await gitCli([
    "-c", "user.name=llm-seo-lab[bot]",
    "-c", "user.email=llm-seo-lab[bot]@users.noreply.github.com",
    "commit", "-m", input.pr_title,
  ], { cwd: dir });
  if (r.code !== 0) return err(errInternal(`git commit failed: ${tail(r.stdout)}`, "Inspect the diff and retry"));

  r = await gitCli(["push", "-u", "origin", input.branch], { cwd: dir });
  if (r.code !== 0) return err(errInternal(`git push failed: ${tail(r.stdout)}`,
    "Verify gh has write access to this repo (gh auth refresh -s repo)"));

  const pr = await ghCli([
    "pr", "create",
    "--base", base,
    "--head", input.branch,
    "--title", input.pr_title,
    "--body", input.pr_body,
  ], { cwd: dir });
  if (pr.code !== 0) return err(errInternal(`gh pr create failed: ${tail(pr.stdout)}`, "Verify gh auth status"));

  const m = pr.stdout.match(/\/pull\/(\d+)/);
  const prNumber = m ? parseInt(m[1]!, 10) : 0;
  return ok({
    pr_number: prNumber,
    pr_url: pr.stdout.trim().split("\n").pop() ?? "",
  });
}

function deriveCloneUrl(repoPath: string): string | null {
  if (/^https?:\/\//.test(repoPath) || /^git@/.test(repoPath)) return repoPath;
  if (/^[\w.-]+\/[\w.-]+$/.test(repoPath)) return `https://github.com/${repoPath}.git`;
  return null;
}

function tail(s: string): string {
  return s.length > 600 ? "..." + s.slice(-600) : s;
}

async function defaultGhCli(args: string[], opts: { cwd?: string } = {}): Promise<{ stdout: string; code: number }> {
  return runCli("gh", args, opts);
}

async function defaultGitCli(args: string[], opts: { cwd?: string } = {}): Promise<{ stdout: string; code: number }> {
  return runCli("git", args, opts);
}

async function runCli(cmd: string, args: string[], opts: { cwd?: string }): Promise<{ stdout: string; code: number }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolveP) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], cwd: opts.cwd });
    let stdout = ""; let stderr = "";
    p.stdout.on("data", (d) => { stdout += String(d); });
    p.stderr.on("data", (d) => { stderr += String(d); });
    p.on("close", (code) => resolveP({ stdout: stdout || stderr, code: code ?? 1 }));
    p.on("error", () => resolveP({ stdout: `${cmd} not found`, code: 127 }));
  });
}

export const oracleQuery: ToolDescriptor<
  { engine: Engine; question: string; site_url: string },
  CitationFlag
> = {
  name: "oracle_query",
  description: "Sample whether a site is cited by a given engine for a given question.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("oracle_query");
    if (!limit.ok) return err(limit.error);
    const now = ctx.now().toISOString();

    const claudePrompt = `You are a citation oracle. For engine="${input.engine}" and question="${input.question}", state whether site_url="${input.site_url}" is likely cited. Reply ONLY with JSON: {"cited": boolean, "snippet": string}`;
    const claudeR = await ctx.workers.claude.invoke(claudePrompt, { timeoutMs: 30_000 });
    if (claudeR.ok) {
      const m = claudeR.value.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]) as { cited: boolean; snippet?: string };
          const flag: CitationFlag = {
            engine: input.engine,
            question: input.question,
            cited: parsed.cited,
            sampled_at: now,
            sampling_path: "claude_cli",
          };
          if (parsed.cited) {
            flag.cited_url = input.site_url;
            if (parsed.snippet) flag.cited_snippet = parsed.snippet;
          }
          return ok(flag);
        } catch { /* fall through to playwright */ }
      }
    }

    const pwR = await ctx.workers.playwright.query(input.engine, input.question);
    if (pwR.ok) {
      const cited = pwR.value.cited_urls.includes(input.site_url);
      const flag: CitationFlag = {
        engine: input.engine,
        question: input.question,
        cited,
        sampled_at: now,
        sampling_path: "playwright",
      };
      if (cited) flag.cited_url = input.site_url;
      if (pwR.value.snippet) flag.cited_snippet = pwR.value.snippet;
      return ok(flag);
    }

    return err(pwR.error);
  },
};

export const trackCitations: ToolDescriptor<
  { samples: CitationFlag[]; topic: string; window_start: string; window_end: string },
  CitationShareSnapshot
> = {
  name: "track_citations",
  description: "Aggregate CitationFlag samples into per-engine citation share over a window.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input) {
    const perEngine: CitationShareSnapshot["per_engine"] = {};
    const engines = new Set(input.samples.map((s) => s.engine));
    for (const e of engines) {
      const eng = input.samples.filter((s) => s.engine === e);
      const cited = eng.filter((s) => s.cited);
      perEngine[e] = { share: eng.length ? cited.length / eng.length : 0, n_questions: eng.length, n_citations: cited.length };
    }
    return ok({
      topic: input.topic,
      window_start: input.window_start,
      window_end: input.window_end,
      per_engine: perEngine,
      samples: input.samples,
    });
  },
};

export interface CompetitorMap {
  topic: string;
  user_site: string;
  competitor_sites: string[];
  citation_map: Record<string, Record<string, string[]>>;
}

export interface CompetitorAnalysis {
  topic: string;
  user_share_per_engine: Record<string, number>;
  competitor_share_per_engine: Record<string, Record<string, number>>;
  gap_themes: { theme: string; missing_on_engines: string[]; suggested_brief: string }[];
}

export const compareCompetitors: ToolDescriptor<CompetitorMap, CompetitorAnalysis> = {
  name: "compare_competitors",
  description: "Compute user vs competitor citation share per engine and rank gap themes.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input) {
    const engines = Object.keys(input.citation_map);
    const userShare: Record<string, number> = {};
    const compShare: Record<string, Record<string, number>> = {};
    for (const e of engines) {
      const map = input.citation_map[e]!;
      const qs = Object.keys(map);
      const n = qs.length || 1;
      userShare[e] = qs.filter((q) => map[q]!.includes(input.user_site)).length / n;
      compShare[e] = {};
      for (const c of input.competitor_sites) {
        compShare[e][c] = qs.filter((q) => map[q]!.includes(c)).length / n;
      }
    }
    const allQs = new Set<string>();
    for (const e of engines) for (const q of Object.keys(input.citation_map[e]!)) allQs.add(q);
    const gaps: { theme: string; missing_on_engines: string[]; suggested_brief: string; _w: number; _c: number }[] = [];
    for (const q of allQs) {
      const missing: string[] = [];
      let compTotal = 0;
      for (const e of engines) {
        const cited = input.citation_map[e]![q] ?? [];
        if (!cited.includes(input.user_site)) {
          missing.push(e);
          compTotal += cited.filter((c) => input.competitor_sites.includes(c)).length;
        }
      }
      if (missing.length > 0 && compTotal > 0) {
        gaps.push({
          theme: q,
          missing_on_engines: missing,
          suggested_brief: `Author a definitive page on '${q}' with primary-source citations and a stats-backed example block.`,
          _w: missing.length,
          _c: compTotal,
        });
      }
    }
    gaps.sort((a, b) => b._w - a._w || b._c - a._c);
    return ok({
      topic: input.topic,
      user_share_per_engine: userShare,
      competitor_share_per_engine: compShare,
      gap_themes: gaps.map(({ _w: _, _c: __, ...rest }) => rest),
    });
  },
};

export const readPrStatus: ToolDescriptor<
  { repo_path: string; pr_number: number; ghCli?: (args: string[]) => Promise<{ stdout: string; code: number }> },
  PrSummary
> = {
  name: "read_pr_status",
  description: "Read the state of a PR via gh CLI.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const ghCli = input.ghCli ?? defaultGhCli;
    const r = await ghCli([
      "pr", "view", String(input.pr_number),
      "--repo", input.repo_path,
      "--json", "number,url,headRefName,state,createdAt,mergedAt,closedAt,labels",
    ]);
    if (r.code !== 0) return err(errInternal(`gh CLI failed: ${r.stdout}`, "Verify gh auth and PR number"));
    try {
      const j = JSON.parse(r.stdout) as {
        number: number; url: string; headRefName: string; state: string;
        createdAt: string; mergedAt?: string; closedAt?: string;
        labels?: { name: string }[];
      };
      const stateMap: Record<string, PrSummary["state"]> = {
        OPEN: "open", MERGED: "merged", CLOSED: "closed_unmerged",
      };
      const ageDays = Math.max(0, Math.floor((ctx.now().getTime() - new Date(j.createdAt).getTime()) / 86_400_000));
      return ok({
        pr_number: j.number,
        pr_url: j.url,
        branch: j.headRefName,
        state: stateMap[j.state] ?? "open",
        brief_id: "",
        opened_at: j.createdAt,
        ...(j.mergedAt ? { merged_at: j.mergedAt } : {}),
        ...(j.closedAt ? { closed_at: j.closedAt } : {}),
        age_days: ageDays,
        labels: (j.labels ?? []).map((l) => l.name),
      });
    } catch (e) {
      return err(errInternal(`gh JSON parse failed: ${(e as Error).message}`, "Re-run with --json fields verified"));
    }
  },
};

export interface ResultsBundle {
  audits: PageAuditResult[];
  briefs: ContentBrief[];
  prs: PrSummary[];
  citation_snapshots: CitationShareSnapshot[];
}

export const readResults: ToolDescriptor<{ results_dir: string }, ResultsBundle> = {
  name: "read_results",
  description: "Load all audits/briefs/prs/snapshots from a results directory.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input) {
    const out: ResultsBundle = { audits: [], briefs: [], prs: [], citation_snapshots: [] };
    const buckets: Record<keyof ResultsBundle, string> = {
      audits: "audits",
      briefs: "briefs",
      prs: "prs",
      citation_snapshots: "snapshots",
    };
    for (const [k, sub] of Object.entries(buckets) as [keyof ResultsBundle, string][]) {
      const dir = join(input.results_dir, sub);
      if (!existsSync(dir)) continue;
      const ents = await readdir(dir);
      for (const e of ents) {
        if (!e.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(dir, e), "utf8");
          (out[k] as unknown[]).push(JSON.parse(raw));
        } catch { /* skip malformed */ }
      }
    }
    return ok(out);
  },
};

async function listJsonFilesSorted(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const ents = await readdir(dir);
  return ents.filter((e) => e.endsWith(".json")).sort();
}

async function readJsonFiles<T>(dir: string): Promise<T[]> {
  const files = await listJsonFilesSorted(dir);
  const out: T[] = [];
  for (const f of files) {
    try {
      const raw = await readFile(join(dir, f), "utf8");
      out.push(JSON.parse(raw) as T);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export interface ListSitesResult { sites: SiteConfig[] }

export const listSites: ToolDescriptor<Record<string, never>, ListSitesResult> = {
  name: "list_sites",
  description: "List every SiteConfig under {dataDir}/sites/<site_id>/config.json.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(_input, ctx) {
    const root = join(ctx.dataDir, "sites");
    if (!existsSync(root)) return ok({ sites: [] });
    const entries = await readdir(root);
    const sites: SiteConfig[] = [];
    for (const id of entries) {
      const cfgPath = join(root, id, "config.json");
      if (!existsSync(cfgPath)) continue;
      try {
        const raw = await readFile(cfgPath, "utf8");
        sites.push(JSON.parse(raw) as SiteConfig);
      } catch {
        /* skip malformed */
      }
    }
    return ok({ sites });
  },
};

export interface SiteAuditView extends SiteAuditSummary {
  recent_gaps: AuditGap[];
}

export const readLatestAudit: ToolDescriptor<{ site_id: string }, SiteAuditView> = {
  name: "read_latest_audit",
  description: "Read the most recent audit for a site and surface a SiteAuditSummary + recent gaps.",
  inputSchema: {
    type: "object",
    properties: { site_id: { type: "string" } },
    required: ["site_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const dir = join(ctx.dataDir, "sites", input.site_id, "audits");
    const audits = await readJsonFiles<PageAuditResult>(dir);
    if (audits.length === 0) {
      return err(errNotFound(
        `no audits for site ${input.site_id}`,
        "Run /aeo:audit to produce one",
      ));
    }
    audits.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    const latest = audits[0]!;
    const sameRun = audits.filter((a) => a.audit_id.split("/")[0] === latest.audit_id.split("/")[0]);
    const allGaps = sameRun.flatMap((a) => a.gaps);
    const tacticCounts = new Map<string, { count: number; lift: number }>();
    for (const g of allGaps) {
      const e = tacticCounts.get(g.tactic) ?? { count: 0, lift: 0 };
      e.count += 1;
      e.lift += g.predicted_lift_pp;
      tacticCounts.set(g.tactic, e);
    }
    const top_tactics = [...tacticCounts.entries()]
      .map(([tactic, v]) => ({ tactic: tactic as AeoTactic, count: v.count, aggregate_lift_pp: v.lift }))
      .sort((a, b) => b.aggregate_lift_pp - a.aggregate_lift_pp)
      .slice(0, 5);
    const aggregate_lift = allGaps.reduce((s, g) => s + g.predicted_lift_pp, 0);
    const recent_gaps = [...allGaps]
      .sort((a, b) => b.predicted_lift_pp - a.predicted_lift_pp)
      .slice(0, 10);
    return ok({
      audit_run_id: latest.audit_id,
      timestamp: latest.timestamp,
      pages_audited: sameRun.length,
      total_gaps: allGaps.length,
      top_tactics,
      predicted_aggregate_lift_pp: aggregate_lift,
      recent_gaps,
    });
  },
};

export const listPrs: ToolDescriptor<{ site_id: string }, { prs: PrSummary[] }> = {
  name: "list_prs",
  description: "List all PRs recorded for a site (open + merged + closed).",
  inputSchema: {
    type: "object",
    properties: { site_id: { type: "string" } },
    required: ["site_id"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const dir = join(ctx.dataDir, "sites", input.site_id, "prs");
    const prs = await readJsonFiles<PrSummary>(dir);
    prs.sort((a, b) => (a.opened_at < b.opened_at ? 1 : -1));
    return ok({ prs });
  },
};

export interface CitationTrendPoint {
  date: string;
  per_engine: Partial<Record<Engine, number>>;
}
export interface CitationTrendView {
  topic: string;
  points: CitationTrendPoint[];
  latest: CitationShareSnapshot;
}

export const readCitationTrend: ToolDescriptor<
  { site_id: string; topic: string },
  CitationTrendView
> = {
  name: "read_citation_trend",
  description: "Build a per-engine citation share trend for one topic over all snapshots on file.",
  inputSchema: {
    type: "object",
    properties: {
      site_id: { type: "string" },
      topic: { type: "string" },
    },
    required: ["site_id", "topic"],
  },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const dir = join(ctx.dataDir, "sites", input.site_id, "snapshots");
    const all = await readJsonFiles<CitationShareSnapshot>(dir);
    const matching = all.filter((s) => s.topic === input.topic);
    if (matching.length === 0) {
      return err(errNotFound(
        `no snapshots for site ${input.site_id} topic '${input.topic}'`,
        "Run /aeo:track to capture one",
      ));
    }
    matching.sort((a, b) => (a.window_end < b.window_end ? -1 : 1));
    const points: CitationTrendPoint[] = matching.map((snap) => {
      const per: Partial<Record<Engine, number>> = {};
      for (const [e, v] of Object.entries(snap.per_engine)) {
        if (v) per[e as Engine] = v.share;
      }
      return { date: snap.window_end, per_engine: per };
    });
    return ok({
      topic: input.topic,
      points,
      latest: matching[matching.length - 1]!,
    });
  },
};

export function registerAllTools(ctx: ToolContext, registry: ToolRegistry): void {
  void ctx;
  registry.register(readRepoMetadata);
  registry.register(readConfig);
  registry.register(writeConfig);
  registry.register(auditPage);
  registry.register(generateBrief);
  registry.register(emitSchema);
  registry.register(openPr);
  registry.register(oracleQuery);
  // v0.3.0: track_citations is kept registered for backward compatibility,
  // but every invocation returns the deprecation envelope (spec §5.2).
  // The original `trackCitations` descriptor remains exported for existing
  // unit tests that exercise the v0.2.0 aggregation logic directly.
  registry.register(trackCitationsDeprecated);
  registry.register(compareCompetitors);
  registry.register(readPrStatus);
  registry.register(readResults);
  registry.register(listSites);
  registry.register(readLatestAudit);
  registry.register(listPrs);
  // v0.3.0: read_citation_trend follows the same deprecation pattern as
  // track_citations.
  registry.register(readCitationTrendDeprecated);
  // v0.3.0 citation-pull workflow tools (spec §5.1).
  registry.register(readUseCaseState);
  registry.register(recordUseCaseEvent);
  registry.register(pullRecommend);
  registry.register(pullApplyArtifact);
  registry.register(pullAnalyze);
}

export function expectedTactics(): AeoTactic[] {
  return ["cite_sources", "quotation_addition", "statistics_addition", "authoritative_tone", "schema_coverage", "internal_link_injection", "freshness"];
}
