---
name: aeo:compete
description: Compare the current site's citation share against listed competitors per engine. Runs the competitive-citation-intel skill.
args:
  - name: competitors_path
    type: string
    required: false
    description: Path to a YAML/JSON list of competitor URLs. Defaults to .llm-seo-lab/competitors.yaml.
---

# /aeo:compete

Run the `competitive-citation-intel` skill via MCP tool `compare_competitors`.

## What this does

1. Loads SiteConfig and the competitors file.
2. Calls MCP tool `compare_competitors` with the user_site, competitor list, recent citation data, and engine list.
3. Produces:
   - Per-engine share-of-voice ranking.
   - Δ vs prior 14-day window per competitor per engine.
   - Topic gaps the competitor covers but the user does not.
   - Recommended next /aeo:fix targets.

## Output

`.llm-seo-lab/competitive/<timestamp>/report.md` with:

- Share-of-voice table.
- Topic-coverage matrix.
- Recommended-action list (each row links to a /aeo:fix invocation).

## Behaviour

- Uses the most recent citation data from `/aeo:track`; if older than `evidence_policy.max_data_age_days`, asks the user to re-run /aeo:track first.
- Requires at least 1 and at most 10 competitors per run (cost guardrail).

## Stop conditions

- Competitor count out of bounds.
- Citation data missing or stale beyond the policy window.
