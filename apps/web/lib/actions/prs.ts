import type { PrSummary } from "@llm-seo-lab/shared";
import type { McpHttpClient } from "../mcp-client.ts";
import { McpHttpClient as DefaultClient } from "../mcp-client.ts";

export interface PrQueueView {
  open: PrSummary[];
  merged: PrSummary[];
  closed_unmerged: PrSummary[];
}

export async function listPrs(
  site_id: string,
  deps: { client?: McpHttpClient } = {},
): Promise<PrQueueView> {
  const client = deps.client ?? new DefaultClient();
  const all = await client.call<{ prs: PrSummary[] }>("list_prs", { site_id });
  return {
    open: all.prs.filter((p) => p.state === "open"),
    merged: all.prs.filter((p) => p.state === "merged"),
    closed_unmerged: all.prs.filter((p) => p.state === "closed_unmerged"),
  };
}
