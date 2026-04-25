import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listSites, readSiteConfig } from "./sites.ts";
import type { McpHttpClient } from "../mcp-client.ts";
import type { SiteConfig } from "@llm-seo-lab/shared";

function fakeClient(handler: (tool: string, input: unknown) => unknown): McpHttpClient {
  return { call: async (tool: string, input: unknown) => handler(tool, input) } as unknown as McpHttpClient;
}

const FIXTURE: SiteConfig = {
  site_id: "technektar.dev",
  repo_path: "/Users/me/code/technektar.dev",
  site_url: "https://technektar.dev",
  tier: "indie",
  action_substrate: "git",
  engines: ["claude_ai", "perplexity", "chatgpt", "gemini", "google_aio"],
  topics: ["static site SEO", "indie dev"],
  question_banks: {},
  evidence_policy: { require_tier1_first: true, min_predicted_lift_pp: 5 },
  rate_limits: {
    audit_page_per_minute: 10,
    oracle_query_per_minute: 10,
    generate_brief_per_minute: 5,
    open_pr_per_minute: 2,
  },
  telemetry: false,
};

describe("listSites", () => {
  it("flattens SiteConfig[] into SiteListItem[]", async () => {
    const client = fakeClient((tool) => {
      assert.equal(tool, "list_sites");
      return { sites: [FIXTURE] };
    });
    const r = await listSites({ client });
    assert.equal(r.sites.length, 1);
    const s = r.sites[0]!;
    assert.equal(s.site_id, "technektar.dev");
    assert.equal(s.engines_count, 5);
    assert.equal(s.topics_count, 2);
    assert.equal(s.tier, "indie");
    assert.match(r.retrieved_at, /\d{4}-\d{2}-\d{2}T/);
  });

  it("handles empty list", async () => {
    const client = fakeClient(() => ({ sites: [] }));
    const r = await listSites({ client });
    assert.equal(r.sites.length, 0);
  });
});

describe("readSiteConfig", () => {
  it("passes site_id through and returns the SiteConfig", async () => {
    const client = fakeClient((tool, input) => {
      assert.equal(tool, "read_config");
      assert.deepEqual(input, { site_id: "technektar.dev" });
      return FIXTURE;
    });
    const r = await readSiteConfig("technektar.dev", { client });
    assert.equal(r.site_url, "https://technektar.dev");
  });
});
