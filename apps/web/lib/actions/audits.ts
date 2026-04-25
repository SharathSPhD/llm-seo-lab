import type { SiteAuditSummary, AuditGap } from "@llm-seo-lab/shared";
import type { McpHttpClient } from "../mcp-client.ts";
import { McpHttpClient as DefaultClient } from "../mcp-client.ts";

export interface SiteAuditView extends SiteAuditSummary {
  recent_gaps: AuditGap[];
}

export async function getLatestAudit(
  site_id: string,
  deps: { client?: McpHttpClient } = {},
): Promise<SiteAuditView> {
  const client = deps.client ?? new DefaultClient();
  return client.call<SiteAuditView>("read_latest_audit", { site_id });
}
