import type { JobRecord } from "../types.ts";
import type { McpClient } from "../mcp_client.ts";
import type {
  SiteConfig,
  PageAuditResult,
  AuditGap,
  ContentBrief,
  PrSummary,
} from "@llm-seo-lab/shared";

export interface LoopRunnerDeps {
  mcp: McpClient;
  emitProgress?: (step: string, data?: Record<string, unknown>) => void;
  /**
   * Optional clock injection (used by tests). Defaults to `Date.now`.
   */
  now?: () => number;
}

export interface LoopRunnerResult {
  audit_id: string;
  pr_id?: string;
  pr_url?: string;
  gaps_filed: number;
  next_step: "human_review" | "no_qualifying_gaps" | "no_seed_pages" | "quota_exhausted";
}

/**
 * One audit run -> filter Tier-1 gaps -> draft brief -> open PR.
 *
 * Aligned to the real MCP tool schemas (see `mcp/src/tools/index.ts`):
 *   read_config({site_id})            -> SiteConfig
 *   audit_page({page_url, page_html?}) -> PageAuditResult
 *   generate_brief({gap, page_url, page_html, repo_path}) -> ContentBrief
 *   open_pr({repo_path, branch, brief_id, pr_title, pr_body}) -> PrSummary
 *
 * The MCP HTTP client unwraps the `{ok, value}` envelope and throws
 * `McpToolError` on tool-level failure. We let those propagate so the
 * daemon can mark the job failed and surface the actionable next step.
 */
export async function runLoopOnce(job: JobRecord, deps: LoopRunnerDeps): Promise<LoopRunnerResult> {
  const emit = deps.emitProgress ?? (() => undefined);
  const site_id = (job.payload["site_id"] as string | undefined) ?? job.site_id;

  emit("read_config", { site_id });
  const cfg = (await deps.mcp.call("read_config", { site_id })) as SiteConfig;

  const seedPages = cfg.seed_pages && cfg.seed_pages.length > 0 ? cfg.seed_pages : [cfg.site_url];
  const maxGaps = cfg.max_gaps_per_pr ?? 3;
  const minLift = cfg.evidence_policy.min_predicted_lift_pp;
  const tier1Only = cfg.evidence_policy.require_tier1_first;

  emit("audit_page", { pages: seedPages.length });
  const audits: PageAuditResult[] = [];
  for (const page_url of seedPages) {
    const a = (await deps.mcp.call("audit_page", { page_url })) as PageAuditResult;
    audits.push(a);
  }

  const allGaps: { gap: AuditGap; page_url: string }[] = [];
  for (const a of audits) {
    for (const g of a.gaps) allGaps.push({ gap: g, page_url: a.page_url });
  }
  const filtered = allGaps
    .filter(({ gap }) => (tier1Only ? gap.evidence_tier === "tier1" : true))
    .filter(({ gap }) => gap.predicted_lift_pp >= minLift)
    .sort((a, b) => b.gap.predicted_lift_pp - a.gap.predicted_lift_pp)
    .slice(0, maxGaps);

  const headlineAudit = audits[0]!;

  if (filtered.length === 0) {
    emit("filter", { result: "no_qualifying_gaps", inspected: allGaps.length });
    return { audit_id: headlineAudit.audit_id, gaps_filed: 0, next_step: "no_qualifying_gaps" };
  }

  emit("generate_brief", { count: filtered.length });
  const briefs: ContentBrief[] = [];
  for (const { gap, page_url } of filtered) {
    const b = (await deps.mcp.call("generate_brief", {
      gap,
      page_url,
      page_html: "",
      repo_path: cfg.repo_path,
    })) as ContentBrief;
    briefs.push(b);
  }

  const branch = `aeo-fix/${headlineAudit.audit_id}`;
  const headBrief = briefs[0]!;

  emit("open_pr", { brief_id: headBrief.brief_id, branch });
  const pr = (await deps.mcp.call("open_pr", {
    repo_path: cfg.repo_path,
    branch,
    brief_id: headBrief.brief_id,
    pr_title: `AEO: close ${filtered.length} Tier-1 citation gap${filtered.length === 1 ? "" : "s"}`,
    pr_body: renderPrBody(filtered.map((f) => f.gap), briefs, headlineAudit.audit_id),
  })) as PrSummary;

  emit("done", { pr_number: pr.pr_number, pr_url: pr.pr_url });
  return {
    audit_id: headlineAudit.audit_id,
    pr_id: `pr:${pr.pr_number}`,
    pr_url: pr.pr_url,
    gaps_filed: filtered.length,
    next_step: "human_review",
  };
}

function renderPrBody(gaps: AuditGap[], briefs: ContentBrief[], audit_id: string): string {
  const rows = gaps
    .map((g, i) => {
      const brief = briefs[i];
      const briefRef = brief ? ` (brief ${brief.brief_id})` : "";
      return `${i + 1}. **${g.tactic}** — predicted +${g.predicted_lift_pp}pp citation share. Reference: ${g.geo_paper_reference}${briefRef}`;
    })
    .join("\n");
  return [
    `## What this PR does`,
    ``,
    `Closes ${gaps.length} Tier-1 evidence gap${gaps.length === 1 ? "" : "s"} surfaced by the latest llm-seo-lab audit.`,
    ``,
    `## Gaps`,
    ``,
    rows,
    ``,
    `## Loop metadata`,
    ``,
    `- pre_audit_id: ${audit_id}`,
    `- expected_measurement_window_days: 14`,
    `- next_step_after_merge: \`/aeo:loop --continue=pr:NN\``,
  ].join("\n");
}
