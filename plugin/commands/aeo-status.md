---
name: aeo:status
description: Show closed-loop AEO state for the current site — open PRs, last audit, last citation trend. Read-only.
argument-hint: "[site_id]"
allowed-tools: Bash
---

You are running the `aeo:status` command for the **llm-seo-lab** plugin.

`$ARGUMENTS` (optional) is a `site_id`. If empty, list every known site.

This is a **read-only** report. Do **not** call any write-side MCP tool.

## Step 1 — list every site under data/

Run, exactly:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" list_sites
```

If the user supplied an argument, treat it as a `site_id` filter and skip to Step 2.

If `list_sites` returns an empty `sites` array, tell the user to run `/aeo:bootstrap` first and stop.

## Step 2 — for each site, summarise its current loop state

For each `site_id` in scope, call these three read-side tools in order:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config        '{"site_id":"<SITE_ID>"}'
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_latest_audit  '{"site_id":"<SITE_ID>"}'
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" list_prs           '{"site_id":"<SITE_ID>"}'
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_citation_trend '{"site_id":"<SITE_ID>"}'
```

Each call returns the bare `value` (the helper unwraps the `{ok,value}` envelope) or exits non-zero with the error envelope on stderr — surface failures honestly, do **not** invent data.

## Step 3 — print a single-screen report

For every site, print exactly:

- `site_id` and `site_url`
- Last audit timestamp + the count of unresolved Tier-1 gaps (top 3 by `predicted_lift_pp`)
- Open PR count and the most recent PR (id, branch, age)
- Last citation snapshot timestamp and current per-engine share

End with a one-line **next-action** suggestion (`/aeo:audit`, `/aeo:fix`, `/aeo:track`, or `/aeo:loop`) inferred from the state — e.g. no audit yet ⇒ `/aeo:audit`; audits exist but no PRs ⇒ `/aeo:fix`; PRs merged but no fresh trend ⇒ `/aeo:track`.

## Stop conditions

- The MCP server is unreachable (`aeo-mcp.sh` exits non-zero with a connection error). Tell the user to start the cli-worker daemon (`npm run start --workspace=cli-worker`) or the MCP server directly (`node mcp/bin/llm-seo-lab-mcp.mjs --port=7301`).
- No sites configured — tell the user to run `/aeo:bootstrap`.
