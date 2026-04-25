import type { SiteConfig } from "@llm-seo-lab/shared";
import type { McpHttpClient } from "../mcp-client.ts";
import { McpHttpClient as DefaultClient } from "../mcp-client.ts";

/**
 * Server-side action surface for the dashboard. These functions are designed
 * to be called from React Server Components and Server Actions; they do not
 * touch any browser API and can be unit-tested with an injected MCP client.
 */

export interface SiteListItem {
  site_id: string;
  site_url: string;
  tier: SiteConfig["tier"];
  action_substrate: SiteConfig["action_substrate"];
  engines_count: number;
  topics_count: number;
}

export interface ListSitesResult {
  sites: SiteListItem[];
  retrieved_at: string;
}

export interface SitesActionDeps {
  client?: McpHttpClient;
}

function defaultClient(): McpHttpClient {
  return new DefaultClient();
}

export async function listSites(deps: SitesActionDeps = {}): Promise<ListSitesResult> {
  const client = deps.client ?? defaultClient();
  const raw = await client.call<{ sites: SiteConfig[] }>("list_sites", {});
  const sites = raw.sites.map((s) => ({
    site_id: s.site_id,
    site_url: s.site_url,
    tier: s.tier,
    action_substrate: s.action_substrate,
    engines_count: s.engines.length,
    topics_count: s.topics.length,
  }));
  return { sites, retrieved_at: new Date().toISOString() };
}

export async function readSiteConfig(
  site_id: string,
  deps: SitesActionDeps = {},
): Promise<SiteConfig> {
  const client = deps.client ?? defaultClient();
  return client.call<SiteConfig>("read_config", { site_id });
}
