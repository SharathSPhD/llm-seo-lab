import type { CitationShareSnapshot, Engine, StatisticalDelta } from "@llm-seo-lab/shared";
import type { McpHttpClient } from "../mcp-client.ts";
import { McpHttpClient as DefaultClient } from "../mcp-client.ts";

export interface CitationTrendPoint {
  date: string;
  per_engine: Partial<Record<Engine, number>>;
}

export interface CitationTrendView {
  topic: string;
  points: CitationTrendPoint[];
  latest: CitationShareSnapshot;
}

export async function getCitationTrend(
  site_id: string,
  topic: string,
  deps: { client?: McpHttpClient } = {},
): Promise<CitationTrendView> {
  const client = deps.client ?? new DefaultClient();
  return client.call<CitationTrendView>("read_citation_trend", { site_id, topic });
}

export async function getResultsForPr(
  site_id: string,
  pr_number: number,
  deps: { client?: McpHttpClient } = {},
): Promise<{ deltas: StatisticalDelta[]; pr_number: number }> {
  const client = deps.client ?? new DefaultClient();
  return client.call<{ deltas: StatisticalDelta[]; pr_number: number }>("read_results", { site_id, pr_number });
}
