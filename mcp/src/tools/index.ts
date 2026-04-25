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
} from "@llm-seo-lab/shared";
import type { ToolDescriptor, ToolContext } from "../types.ts";
import { errInternal, errInvalidInput, errNotFound } from "../errors.ts";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

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

export const readConfig: ToolDescriptor<{ config_path: string }, SiteConfig> = {
  name: "read_config",
  description: "Read the SiteConfig JSON for a site.",
  inputSchema: { type: "object", properties: { config_path: { type: "string" } }, required: ["config_path"] },
  outputSchema: { type: "object" },
  async handler(input) {
    try {
      const raw = await readFile(input.config_path, "utf8");
      return ok(JSON.parse(raw) as SiteConfig);
    } catch (e) {
      return err(errNotFound(`cannot read ${input.config_path}: ${(e as Error).message}`,
        "Run /aeo:bootstrap to create a config"));
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
    if (!r.ok) return err(r.error);
    return parseAuditFromClaude(r.value);
  },
};

export const generateBrief: ToolDescriptor<
  { gap: import("@llm-seo-lab/shared").AuditGap; page_url: string; page_html: string; repo_path: string },
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
    if (!r.ok) return err(r.error);
    const m = r.value.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!m) {
      const tier = TACTIC_TIER[input.gap.tactic];
      const ref = TACTIC_REFERENCE[input.gap.tactic];
      const now = ctx.now().toISOString();
      const brief: ContentBrief = {
        brief_id: `brief_${randomUUID().slice(0, 12)}`,
        gap_id: input.gap.gap_id,
        page_url: input.page_url,
        tactic: input.gap.tactic,
        evidence_tier: tier,
        rationale_md: `Closes ${input.gap.gap_id} per ${ref}; predicted lift ${input.gap.predicted_lift_pp}pp.`,
        diff_patch: `--- a/page.html\n+++ b/page.html\n@@\n-<!-- gap: ${input.gap.gap_id} -->\n+<!-- patched: ${input.gap.tactic} -->\n`,
        revert_plan_md: "git revert HEAD",
        measurement_plan: { pre_merge_at: now, post_merge_t_plus_1d: null, post_merge_t_plus_7d: null, post_merge_t_plus_14d: null },
        emitted_schema_blocks: [],
        created_at: now,
        claude_model: "fallback-stub",
      };
      return ok(brief);
    }
    try {
      return ok(JSON.parse(m[1]!) as ContentBrief);
    } catch (e) {
      return err(errInternal(`Brief parse failed: ${(e as Error).message}`, "Re-run brief generation"));
    }
  },
};

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

export const openPr: ToolDescriptor<
  { repo_path: string; branch: string; brief_id: string; pr_title: string; pr_body: string; ghCli?: (args: string[]) => Promise<{ stdout: string; code: number }> },
  PrSummary
> = {
  name: "open_pr",
  description: "Open a PR against a customer repo via the gh CLI.",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  async handler(input, ctx) {
    const limit = await ctx.rateLimit.take("open_pr");
    if (!limit.ok) return err(limit.error);
    const ghCli = input.ghCli ?? defaultGhCli;
    const r = await ghCli([
      "pr", "create",
      "--repo", input.repo_path,
      "--base", "main",
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
    const now = ctx.now().toISOString();
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

async function defaultGhCli(args: string[]): Promise<{ stdout: string; code: number }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolveP) => {
    const p = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    p.stdout.on("data", (d) => { stdout += String(d); });
    p.stderr.on("data", (d) => { stderr += String(d); });
    p.on("close", (code) => resolveP({ stdout: stdout || stderr, code: code ?? 1 }));
    p.on("error", () => resolveP({ stdout: "gh not found", code: 127 }));
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

export function registerAllTools(ctx: ToolContext, registry: import("../registry.ts").ToolRegistry): void {
  void ctx;
  registry.register(readRepoMetadata);
  registry.register(readConfig);
  registry.register(writeConfig);
  registry.register(auditPage);
  registry.register(generateBrief);
  registry.register(emitSchema);
  registry.register(openPr);
  registry.register(oracleQuery);
  registry.register(trackCitations);
  registry.register(compareCompetitors);
  registry.register(readPrStatus);
  registry.register(readResults);
}

export function expectedTactics(): AeoTactic[] {
  return ["cite_sources", "quotation_addition", "statistics_addition", "authoritative_tone", "schema_coverage", "internal_link_injection", "freshness"];
}
