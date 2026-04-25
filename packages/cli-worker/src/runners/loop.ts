import type { JobRecord } from "../types.ts";
import type { McpClient } from "../mcp_client.ts";
import { NoopPratyakshaClient, type PratyakshaClient } from "../pratyaksha_client.ts";
import type {
  SiteConfig,
  PageAuditResult,
  AuditGap,
  ContentBrief,
  PrSummary,
} from "@llm-seo-lab/shared";

export interface LoopRunnerDeps {
  mcp: McpClient;
  pratyaksha?: PratyakshaClient;
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
  next_step:
    | "human_review"
    | "no_qualifying_gaps"
    | "no_seed_pages"
    | "quota_exhausted"
    | "buddhi_blocked";
  buddhi?: {
    pratyaksha_available: boolean;
    conflicts_detected: number;
    sublations_recorded: number;
    blocked_briefs: number;
  };
}

/**
 * One audit run -> filter Tier-1 gaps -> Manas drafts -> Buddhi gate ->
 * open PR.
 *
 * Aligned to the real MCP tool schemas (see `mcp/src/tools/index.ts`):
 *   read_config({site_id})            -> SiteConfig
 *   audit_page({page_url, page_html?}) -> PageAuditResult
 *   generate_brief({gap, page_url, page_html, repo_path}) -> ContentBrief
 *   open_pr({repo_path, branch, brief_id, pr_title, pr_body}) -> PrSummary
 *
 * R3 verdict (`docs/decisions/2026-04-26-pratyaksha-integration.md`) wires
 * Sākṣī + Sublation + Manas/Buddhi at this layer:
 *
 *   Manas  = `generate_brief` (one fast claude --print call per gap)
 *   Buddhi = pratyaksha.detect_conflict against the prior recommendations
 *            for this (qualificand=site_id::page_url, qualifier=tactic) bucket.
 *            On conflict + higher precision, sublate_with_evidence; on
 *            conflict + lower precision, the brief is dropped and the PR is
 *            blocked for that gap.
 *
 * If the daemon was started without pratyaksha (or it is unavailable),
 * the loop degrades to the pre-R3 behaviour with `pratyaksha_available:
 * false` recorded in the result so the user can see what happened.
 *
 * The MCP HTTP client unwraps the `{ok, value}` envelope and throws
 * `McpToolError` on tool-level failure. We let those propagate so the
 * daemon can mark the job failed and surface the actionable next step.
 */
export async function runLoopOnce(job: JobRecord, deps: LoopRunnerDeps): Promise<LoopRunnerResult> {
  const emit = deps.emitProgress ?? (() => undefined);
  const pratyaksha: PratyakshaClient = deps.pratyaksha ?? new NoopPratyakshaClient();
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
    return {
      audit_id: headlineAudit.audit_id,
      gaps_filed: 0,
      next_step: "no_qualifying_gaps",
      buddhi: emptyBuddhi(pratyaksha.available),
    };
  }

  emit("manas", { count: filtered.length });
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

  emit("buddhi", { pratyaksha_available: pratyaksha.available, count: briefs.length });
  const cleared: { brief: ContentBrief; gap: AuditGap; page_url: string }[] = [];
  let conflicts_detected = 0;
  let sublations_recorded = 0;
  let blocked_briefs = 0;

  for (let i = 0; i < briefs.length; i += 1) {
    const brief = briefs[i]!;
    const { gap, page_url } = filtered[i]!;
    const qualificand = `${site_id}::${page_url}`;

    const briefPrecision = clampPrecision(gap.predicted_lift_pp / 20);
    const candidate = briefSummary(brief, gap);

    let conflicted = false;
    let blocked = false;

    try {
      const prior = await pratyaksha.contextRetrieve({
        qualificand,
        qualifier: gap.tactic,
        precision_threshold: 0.1,
        max_elements: 20,
      });

      const olderHigherPrecision = (prior.elements ?? []).filter(
        (e) => e.precision >= briefPrecision && tokenJaccard(e.content, candidate) < 0.5,
      );
      const olderLowerPrecision = (prior.elements ?? []).filter(
        (e) => e.precision < briefPrecision && tokenJaccard(e.content, candidate) < 0.5,
      );

      if (olderLowerPrecision.length > 0) {
        const target = olderLowerPrecision[0]!;
        conflicts_detected += 1;
        conflicted = true;
        const sub = await pratyaksha.sublateWithEvidence({
          older_id: target.id,
          newer_content: candidate,
          newer_precision: briefPrecision,
          qualificand,
          qualifier: gap.tactic,
          condition: `tier=${gap.evidence_tier}`,
          provenance: `brief:${brief.brief_id}`,
        });
        if (sub.ok && !sub.already_sublated) sublations_recorded += 1;
      }

      if (olderHigherPrecision.length > 0) {
        conflicts_detected += 1;
        blocked = true;
        blocked_briefs += 1;
      } else {
        await pratyaksha.contextInsert({
          id: brief.brief_id,
          content: candidate,
          precision: briefPrecision,
          qualificand,
          qualifier: gap.tactic,
          condition: `tier=${gap.evidence_tier}`,
          provenance: `brief:${brief.brief_id}`,
        });
      }
    } catch (e) {
      emit("buddhi_warn", { error: (e as Error).message });
    }

    if (!blocked) cleared.push({ brief, gap, page_url });
    void conflicted;
  }

  if (cleared.length === 0) {
    emit("buddhi_blocked", { conflicts_detected, sublations_recorded, blocked_briefs });
    return {
      audit_id: headlineAudit.audit_id,
      gaps_filed: 0,
      next_step: "buddhi_blocked",
      buddhi: { pratyaksha_available: pratyaksha.available, conflicts_detected, sublations_recorded, blocked_briefs },
    };
  }

  const branch = `aeo-fix/${headlineAudit.audit_id}`;
  const headBrief = cleared[0]!.brief;

  emit("open_pr", { brief_id: headBrief.brief_id, branch });
  const pr = (await deps.mcp.call("open_pr", {
    repo_path: cfg.repo_path,
    branch,
    brief_id: headBrief.brief_id,
    pr_title: `AEO: close ${cleared.length} Tier-1 citation gap${cleared.length === 1 ? "" : "s"}`,
    pr_body: renderPrBody(
      cleared.map((c) => c.gap),
      cleared.map((c) => c.brief),
      headlineAudit.audit_id,
      { conflicts_detected, sublations_recorded, blocked_briefs, pratyaksha_available: pratyaksha.available },
    ),
  })) as PrSummary;

  emit("done", { pr_number: pr.pr_number, pr_url: pr.pr_url, conflicts_detected, sublations_recorded });
  return {
    audit_id: headlineAudit.audit_id,
    pr_id: `pr:${pr.pr_number}`,
    pr_url: pr.pr_url,
    gaps_filed: cleared.length,
    next_step: "human_review",
    buddhi: { pratyaksha_available: pratyaksha.available, conflicts_detected, sublations_recorded, blocked_briefs },
  };
}

function emptyBuddhi(available: boolean): NonNullable<LoopRunnerResult["buddhi"]> {
  return { pratyaksha_available: available, conflicts_detected: 0, sublations_recorded: 0, blocked_briefs: 0 };
}

function clampPrecision(p: number): number {
  if (Number.isNaN(p)) return 0.5;
  if (p < 0.05) return 0.05;
  if (p > 0.95) return 0.95;
  return Number(p.toFixed(3));
}

function tokenJaccard(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().match(/\w+/g) ?? []);
  const tokB = new Set(b.toLowerCase().match(/\w+/g) ?? []);
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let inter = 0;
  for (const t of tokA) if (tokB.has(t)) inter += 1;
  const union = tokA.size + tokB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function briefSummary(brief: ContentBrief, gap: AuditGap): string {
  return `${gap.tactic} | tier=${gap.evidence_tier} | lift=${gap.predicted_lift_pp}pp | ${brief.rationale_md.slice(0, 200)}`;
}

function renderPrBody(
  gaps: AuditGap[],
  briefs: ContentBrief[],
  audit_id: string,
  buddhi: { conflicts_detected: number; sublations_recorded: number; blocked_briefs: number; pratyaksha_available: boolean },
): string {
  const rows = gaps
    .map((g, i) => {
      const brief = briefs[i];
      const briefRef = brief ? ` (brief ${brief.brief_id})` : "";
      return `${i + 1}. **${g.tactic}** — predicted +${g.predicted_lift_pp}pp citation share. Reference: ${g.geo_paper_reference}${briefRef}`;
    })
    .join("\n");
  const buddhiNote = buddhi.pratyaksha_available
    ? `- buddhi_gate: ${buddhi.conflicts_detected} conflicts detected, ${buddhi.sublations_recorded} sublations recorded, ${buddhi.blocked_briefs} briefs blocked (kept higher-precision prior recommendation)`
    : `- buddhi_gate: pratyaksha unavailable; sublation gating disabled for this run`;
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
    buddhiNote,
  ].join("\n");
}
