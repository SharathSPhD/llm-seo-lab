---
name: aeo:bootstrap
description: Bootstrap a new site for closed-loop AEO/LLM-SEO. Detects repo type, generates .llm-seo-lab/config.yaml, and offers to open a robots.txt + sitemap fix-up PR.
args: []
---

# /aeo:bootstrap

Bootstrap the current workspace for the llm-seo-lab closed loop.

## What this does

1. Calls MCP tool `read_repo_metadata` on the current workspace.
2. Detects whether the repo is a git repo or a static-mirror shim, whether `sitemap.xml` exists, and estimates page count.
3. Calls MCP tool `write_config` to create `.llm-seo-lab/config.yaml` populated from the `DEFAULT_SITE_CONFIG` template, prompting for:
   - site_id
   - site_url
   - tier (default: indie)
   - engines list (default: claude_ai, perplexity, chatgpt, gemini, google_aio)
   - topics
4. If `robots.txt` blocks AI crawlers (`OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`), offer to open a "PR #1: unblock AI crawlers" via MCP tool `open_pr`.
5. If sitemap.xml is missing or contains placeholder URLs, offer to open a "PR #2: real sitemap" via MCP tool `open_pr`.

## Behaviour

- Refuses to overwrite an existing `.llm-seo-lab/config.yaml` without `--force`.
- Logs every MCP tool call with its input/output for audit.
- Returns a one-screen summary of what was created and what was deferred.

## Stop conditions

- If the workspace is not a git repo and no `--substrate=substack|ghost|webflow` hint is provided, ask the user before continuing.
- If `read_repo_metadata` reports `repo_type: "unknown"`, ask the user to confirm the repo path is correct.
