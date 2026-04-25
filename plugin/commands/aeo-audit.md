---
name: aeo:audit
description: Audit one or more pages for AEO/LLM-SEO citation gaps under the GEO-paper Tier-1 evidence policy. Use when checking AEO health, scoring a page, or finding citation gaps.
args:
  - name: page_glob
    type: string
    required: false
    description: Optional glob like 'pages/blog/**/*.md'. Defaults to all sitemap entries from .llm-seo-lab/config.yaml.
---

# /aeo:audit

Run the `aeo-audit` skill on every page matched by the glob (or every sitemap URL when no glob is provided).

## What this does

1. Reads `.llm-seo-lab/config.yaml` via MCP tool `read_config`.
2. Resolves the target page list from the glob or the sitemap.
3. For each page:
   - Loads the page HTML (filesystem first, fetch fallback for non-git substrates).
   - Calls MCP tool `audit_page`, which delegates to the `aeo-audit` skill.
4. Aggregates results into `.llm-seo-lab/audits/<timestamp>/audits.json` and prints a one-screen summary table.

## Output

For each page:
- 5-axis scores (cite_sources, quotation_addition, statistics_addition, authoritative_tone, schema_coverage), each 0-100.
- Ranked gap list with `tactic`, `evidence_tier`, `predicted_lift_pp`, and `geo_paper_reference`.

## Defaults and rate limits

- Concurrency capped by the SiteConfig `rate_limits.audit_page_per_minute` value.
- Tier-1 gaps are surfaced first; Tier-2 gaps below `evidence_policy.min_predicted_lift_pp` are filtered out by default.
- Use `--include-tier2` to override.

## Stop conditions

- If the rate limiter returns `QUOTA_EXCEEDED`, pause and report the retry-after timestamp.
- If a page fetch fails, record the error and continue with the rest.
