import type { Engine } from "./citation.ts";

export type Tier = "indie" | "builder" | "studio" | "pro";
export type ActionSubstrate = "git" | "substack" | "ghost" | "webflow";

export interface RateLimits {
  audit_page_per_minute: number;
  oracle_query_per_minute: number;
  generate_brief_per_minute: number;
  open_pr_per_minute: number;
}

export interface SiteConfig {
  site_id: string;
  repo_path: string;
  site_url: string;
  tier: Tier;
  action_substrate: ActionSubstrate;
  engines: Engine[];
  topics: string[];
  question_banks: Partial<Record<string, string[]>>;
  evidence_policy: {
    require_tier1_first: boolean;
    min_predicted_lift_pp: number;
  };
  rate_limits: RateLimits;
  telemetry: boolean;
}

export const DEFAULT_RATE_LIMITS_BY_TIER: Record<Tier, RateLimits> = {
  indie: { audit_page_per_minute: 10, oracle_query_per_minute: 10, generate_brief_per_minute: 5, open_pr_per_minute: 2 },
  builder: { audit_page_per_minute: 30, oracle_query_per_minute: 30, generate_brief_per_minute: 15, open_pr_per_minute: 5 },
  studio: { audit_page_per_minute: 60, oracle_query_per_minute: 60, generate_brief_per_minute: 30, open_pr_per_minute: 10 },
  pro: { audit_page_per_minute: 120, oracle_query_per_minute: 120, generate_brief_per_minute: 60, open_pr_per_minute: 20 },
};

export const DEFAULT_SITE_CONFIG: Omit<SiteConfig, "site_id" | "repo_path" | "site_url"> = {
  tier: "indie",
  action_substrate: "git",
  engines: ["claude_ai", "perplexity", "chatgpt", "gemini", "google_aio"],
  topics: [],
  question_banks: {},
  evidence_policy: {
    require_tier1_first: true,
    min_predicted_lift_pp: 5,
  },
  rate_limits: DEFAULT_RATE_LIMITS_BY_TIER.indie,
  telemetry: false,
};
