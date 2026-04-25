import type { JobRecord } from "../types.ts";
import type { McpClient } from "../mcp_client.ts";

export interface LoopRunnerDeps {
  mcp: McpClient;
  emitProgress?: (step: string, data?: Record<string, unknown>) => void;
  question_budget?: number;
}

export interface LoopRunnerResult {
  audit_id: string;
  pr_id?: string;
  pr_url?: string;
  gaps_filed: number;
  next_step: "human_review" | "no_qualifying_gaps" | "quota_exhausted";
}

/**
 * One audit -> filter Tier-1 gaps -> draft brief (+ optional schema) -> open PR.
 * Stops at PR open. Continuation (`/aeo:loop --continue=pr:NN`) is a separate
 * runner.
 */
export async function runLoopOnce(job: JobRecord, deps: LoopRunnerDeps): Promise<LoopRunnerResult> {
  const emit = deps.emitProgress ?? (() => undefined);

  emit("read_config");
  type Cfg = {
    site_id: string;
    pages: string[];
    evidence_policy: { require_tier1_first: boolean; min_predicted_lift_pp: number };
    pr_policy?: { max_gaps_per_pr?: number };
  };
  const cfg = (await deps.mcp.call("read_config", { repo_path: job.payload["repo_path"] ?? "." })) as Cfg;

  emit("audit_page");
  type Audit = {
    audit_id: string;
    gaps: Array<{ id: string; tactic: string; tier: 1 | 2; predicted_lift_pp: number; geo_paper_reference: string }>;
  };
  const audit = (await deps.mcp.call("audit_page", { site_id: cfg.site_id, pages: cfg.pages })) as Audit;

  const minLift = cfg.evidence_policy.min_predicted_lift_pp;
  const maxGaps = cfg.pr_policy?.max_gaps_per_pr ?? 3;
  const filtered = audit.gaps
    .filter((g) => (cfg.evidence_policy.require_tier1_first ? g.tier === 1 : true))
    .filter((g) => g.predicted_lift_pp >= minLift)
    .sort((a, b) => b.predicted_lift_pp - a.predicted_lift_pp)
    .slice(0, maxGaps);

  if (filtered.length === 0) {
    emit("filter", { result: "no_qualifying_gaps" });
    return { audit_id: audit.audit_id, gaps_filed: 0, next_step: "no_qualifying_gaps" };
  }

  emit("generate_brief", { count: filtered.length });
  const briefs = await Promise.all(
    filtered.map((g) =>
      deps.mcp.call("generate_brief", {
        site_id: cfg.site_id,
        gap_id: g.id,
        tactic: g.tactic,
        geo_paper_reference: g.geo_paper_reference,
      }) as Promise<{ unified_diff: string }>,
    ),
  );

  let combinedDiff = briefs.map((b) => b.unified_diff).join("\n");

  const schemaGaps = filtered.filter((g) => g.tactic === "add_schema_markup");
  if (schemaGaps.length > 0) {
    emit("emit_schema", { count: schemaGaps.length });
    const schemas = await Promise.all(
      schemaGaps.map((g) =>
        deps.mcp.call("emit_schema", {
          site_id: cfg.site_id,
          gap_id: g.id,
          facts: { author_name: "TBD", published_at: new Date().toISOString() },
        }) as Promise<{ unified_diff: string }>,
      ),
    );
    combinedDiff += "\n" + schemas.map((s) => s.unified_diff).join("\n");
  }

  emit("open_pr");
  const prResult = (await deps.mcp.call("open_pr", {
    site_id: cfg.site_id,
    branch_name: `aeo-fix/${audit.audit_id}`,
    patch_unified_diff: combinedDiff,
    pr_title: `AEO: close ${filtered.length} Tier-1 citation gap${filtered.length === 1 ? "" : "s"}`,
    pr_body: renderPrBody(filtered, audit.audit_id),
    labels: ["aeo-fix"],
    pre_audit_id: audit.audit_id,
  })) as { pr_id: string; pr_url: string };

  emit("done", { pr_id: prResult.pr_id });
  return {
    audit_id: audit.audit_id,
    pr_id: prResult.pr_id,
    pr_url: prResult.pr_url,
    gaps_filed: filtered.length,
    next_step: "human_review",
  };
}

function renderPrBody(
  gaps: Array<{ id: string; tactic: string; predicted_lift_pp: number; geo_paper_reference: string }>,
  audit_id: string,
): string {
  const rows = gaps
    .map(
      (g, i) =>
        `${i + 1}. **${g.tactic}** — predicted +${g.predicted_lift_pp}pp citation share. Reference: ${g.geo_paper_reference} (gap ${g.id})`,
    )
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
