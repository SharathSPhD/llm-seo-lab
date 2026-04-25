---
name: aeo:status
description: Show the closed-loop state for the current site - open PRs, last audit, last citation track, last result.
args: []
---

# /aeo:status

Print a one-screen state report for the current site.

## What this does

1. Reads SiteConfig.
2. Calls MCP tools:
   - `read_pr_status` for the open PR (if any).
   - `read_results` for the most recent `.llm-seo-lab/results/*.json`.
3. Reads the last `audits.json` and `citations.json` timestamps.
4. Prints:
   - Site id and tier.
   - Last audit at <ts>; top 3 unresolved Tier-1 gaps.
   - Last citation track at <ts>; current per-engine share.
   - Open PR (id, branch, age) or "no open PR".
   - Last completed loop result (Δ citation share, p-value).
5. Suggests the next command (/aeo:audit, /aeo:fix, /aeo:track, or /aeo:loop) based on state.

## Behaviour

- Read-only; no mutations, no MCP write tools called.
- Safe to run any time, including during ralph-loop verification.

## Stop conditions

- None (always succeeds, even if no prior runs exist).
