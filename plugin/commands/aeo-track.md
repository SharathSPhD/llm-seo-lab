---
name: aeo:track
description: Sample citation share across configured engines for a site. Hybrid oracle — Claude CLI primary, Playwright fallback.
argument-hint: "site_id=<id> [questions=<path>] [scope=site|pr:<id>]"
allowed-tools: Bash
---

You are running `aeo:track` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is space-separated `key=value`. Required: `site_id`. Optional: `questions` (path to a YAML/JSON file of buyer questions) and `scope` (`site` default, or `pr:<id>` to scope to questions affected by that PR).

## Step 1 — load the SiteConfig

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config '{"site_id":"<SITE_ID>"}'
```

Use the `engines` list and `rate_limits.track_citations_per_minute` from the config.

## Step 2 — run the citation oracle

For each `(question, engine)` pair, call:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" track_citations '{
  "site_id":"<SITE_ID>",
  "engine":"<ENGINE>",
  "question":"<QUESTION>"
}'
```

The tool routes via the hybrid oracle (Claude CLI primary, Playwright fallback, screenshot ingestion). On per-pair failure, the tool returns an envelope you can inspect — do **not** retry blindly.

For any pair that errors with code `ORACLE_TIMEOUT`, retry once with `oracle_query`:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" oracle_query '{
  "site_id":"<SITE_ID>",
  "engine":"<ENGINE>",
  "question":"<QUESTION>",
  "budget_seconds": 30
}'
```

If `oracle_query` also fails, mark the pair `inconclusive` and continue.

## Step 3 — read back the trend snapshot

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_citation_trend '{"site_id":"<SITE_ID>"}'
```

## Step 4 — summarise

Print the per-engine share-of-voice table, the Δ vs prior 14-day window if a baseline exists, and the count of inconclusive pairs.

## Stop conditions

- `read_config` errors — tell the user to run `/aeo:bootstrap`.
- Rate limit exceeded — pause and report retry-after.
- Playwright fallback requested but `cursor-ide-browser` MCP not registered — surface honestly; do not silently skip.
