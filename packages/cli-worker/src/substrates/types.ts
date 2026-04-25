import type { ActionSubstrate } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";

export interface PublishInput {
  site_id: string;
  branch_name: string;
  patch_unified_diff: string;
  pr_title: string;
  pr_body: string;
  labels?: string[];
}

export interface PublishOutput {
  pr_id: string;
  pr_url: string;
  branch: string;
}

/**
 * A Substrate is the bridge between a "drafted fix" and a "published change".
 * v0.1.0 ships only the git substrate (which calls `gh pr create`); future
 * substrates (substack, ghost, webflow) will save drafts and require manual
 * publish, returning a PublishOutput with pr_url pointing to the draft view.
 */
export interface Substrate {
  readonly name: ActionSubstrate;
  publish(input: PublishInput): Promise<Result<PublishOutput>>;
}

export type SubstrateFactory = (config: Record<string, unknown>) => Substrate;
