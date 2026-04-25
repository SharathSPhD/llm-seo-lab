---
name: aeo:compete
description: Compare the current site's citation share against listed competitors per engine.
argument-hint: "site_id=<id> competitors=<comma_separated_urls>"
allowed-tools: Bash
---

You are running `aeo:compete` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is space-separated `key=value`. Required: `site_id`, `competitors` (1–10 URLs, comma-separated).

## Step 1 — load the SiteConfig and recent citation snapshot

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config         '{"site_id":"<SITE_ID>"}'
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_citation_trend '{"site_id":"<SITE_ID>"}'
```

If `read_citation_trend` returns an empty snapshot or the latest snapshot is older than `evidence_policy.max_data_age_days`, stop and tell the user to run `/aeo:track site_id=<SITE_ID>` first.

## Step 2 — call compare_competitors

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" compare_competitors '{
  "site_id":"<SITE_ID>",
  "competitors":["<URL_1>","<URL_2>", ...]
}'
```

Refuse to call this with fewer than 1 or more than 10 competitor URLs (cost guardrail).

## Step 3 — present the report

The tool returns a per-engine share-of-voice ranking, a Δ vs prior 14-day window per competitor per engine, a topic-coverage matrix, and recommended `/aeo:fix` targets.

Print:

- Top 3 engines where the user is behind a competitor by ≥5 percentage points
- Top 3 topics the competitors cover but the user does not
- For each recommended `/aeo:fix` target, show the predicted lift and link back to the recommended command form

## Stop conditions

- Citation data missing or stale — defer to `/aeo:track`.
- Competitor count out of bounds.
- `compare_competitors` returns `BUDGET_EXCEEDED` — pause and surface.
