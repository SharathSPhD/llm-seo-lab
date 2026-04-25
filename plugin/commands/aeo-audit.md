---
name: aeo:audit
description: Audit one or more pages for AEO/LLM-SEO citation gaps under the GEO-paper Tier-1 evidence policy.
argument-hint: "site_id=<id> [page_url=<url>]"
allowed-tools: Bash
---

You are running `aeo:audit` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is space-separated `key=value`. Required: `site_id`. Optional: `page_url` (overrides the SiteConfig `seed_pages` list with a single URL for ad-hoc audits).

## Step 1 — load the SiteConfig

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config '{"site_id":"<SITE_ID>"}'
```

Refuse to continue if this errors — surface the error envelope to the user verbatim and stop.

## Step 2 — pick the page list

If the user passed `page_url`, audit that single URL. Otherwise audit every entry in `seed_pages` from the SiteConfig (fall back to `[site_url]` if `seed_pages` is empty).

## Step 3 — audit each page

For each page URL, in order:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" audit_page '{"page_url":"<PAGE_URL>"}'
```

Each call returns a `PageAuditResult` with `audit_id`, the 5-axis scores (`cite_sources`, `quotation_addition`, `statistics_addition`, `authoritative_tone`, `schema_coverage`), and a ranked `gaps` array.

If a call returns an error envelope with `code: QUOTA_EXCEEDED`, **stop immediately** — do not retry — and surface `retry_after_seconds` to the user.

## Step 4 — print a one-screen summary

For each page print:

- `audit_id`, page URL, the 5 axis scores
- The top 3 Tier-1 gaps with `tactic`, `predicted_lift_pp`, and `geo_paper_reference`

End with the suggested next command: `/aeo:fix site_id=<SITE_ID>` if any Tier-1 gap clears `evidence_policy.min_predicted_lift_pp`, otherwise `/aeo:track site_id=<SITE_ID>`.

## Stop conditions

- The MCP server is unreachable — tell the user to start it.
- `read_config` returns `NOT_FOUND` — tell the user to run `/aeo:bootstrap` first.
- Any per-page `QUOTA_EXCEEDED` — pause and report the retry-after timestamp.
