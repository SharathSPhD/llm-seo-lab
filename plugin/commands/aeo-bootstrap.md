---
name: aeo:bootstrap
description: Bootstrap a new site for closed-loop AEO/LLM-SEO. Detects repo type, writes data/sites/<site_id>/config.json, opens robots.txt + sitemap fix-up PRs.
argument-hint: "site_id=<id> repo=<git_remote_or_path> [site_url=<url>] [tier=indie|enterprise]"
allowed-tools: Bash
---

You are running `aeo:bootstrap` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is a space-separated `key=value` string. Required keys: `site_id`, `repo`. Optional: `site_url`, `tier` (default `indie`).

## Step 1 — parse and validate

Parse `$ARGUMENTS` into shell variables. Refuse to continue if `site_id` or `repo` is missing — print usage and stop.

Refuse to overwrite an existing config without an explicit `--force`. Check first with:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config '{"site_id":"<SITE_ID>"}' 2>/dev/null && echo EXISTS
```

If the previous call succeeded and the user did not pass `--force`, stop and tell the user to delete `data/sites/<site_id>/config.json` first.

## Step 2 — inspect the repo

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_repo_metadata '{"repo_path":"<REPO>"}'
```

This returns repo type, sitemap presence, robots.txt content, and an estimated page count.

## Step 3 — write the SiteConfig

Construct a SiteConfig JSON literal from the user inputs and the repo metadata. Sensible defaults:

- `engines: ["claude_ai","perplexity","chatgpt","gemini","google_aio"]`
- `evidence_policy.require_tier1_first: true`
- `evidence_policy.min_predicted_lift_pp: 5`
- `pr_policy.max_open_prs: 1`
- `rate_limits.audit_page_per_minute: 10`
- `seed_pages: ["<site_url>/"]`
- `max_gaps_per_pr: 3`

Then:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" write_config '{"site_id":"<SITE_ID>","config":<JSON_LITERAL>}'
```

## Step 4 — propose the unblock-AI-crawlers PR

If `read_repo_metadata` reported that `robots.txt` blocks `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, or `Google-Extended`, ask the user before opening a PR. On confirmation:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" open_pr '{
  "repo_path":"<REPO>",
  "branch":"aeo-bootstrap/unblock-ai-crawlers",
  "brief_id":"bootstrap-robots-txt",
  "pr_title":"AEO bootstrap: unblock AI crawlers in robots.txt",
  "pr_body":"Allows OAI-SearchBot, PerplexityBot, ClaudeBot, and Google-Extended to crawl this site so it becomes eligible for AI Overview / Perplexity / Claude citations."
}'
```

## Step 5 — print a one-screen summary

State exactly what was written, what was deferred, and the next command (`/aeo:audit site_id=<SITE_ID>`).

## Stop conditions

- Missing required arguments.
- Config exists and `--force` not given.
- Repo type comes back `unknown` — ask the user to confirm the repo path.
