---
name: aeo:track
description: Sample citation share across configured engines for a site or PR scope. Hybrid oracle - Claude CLI primary, Playwright fallback, screenshot ingestion last.
args:
  - name: scope
    type: string
    required: false
    description: 'site' (default) or a PR id like 'pr:42' to scope tracking to questions affected by that PR.
  - name: questions_path
    type: string
    required: false
    description: Path to a YAML/JSON file of buyer questions. Defaults to .llm-seo-lab/questions.yaml.
---

# /aeo:track

Run the citation oracle loop for the configured engines.

## What this does

1. Reads SiteConfig and the questions file.
2. For each question x engine pair:
   - Calls MCP tool `track_citations`.
   - The tool routes via the hybrid oracle: Claude CLI primary, Playwright on `cursor-ide-browser` MCP fallback, screenshot ingestion as evidence layer.
3. Aggregates results into `.llm-seo-lab/citations/<timestamp>/citations.json`.
4. Computes `user_share_per_engine` and `competitor_share_per_engine`, plus 14-day trend if priors exist.
5. Calls MCP tool `oracle_query` for any question that timed out, with a smaller per-engine budget for retry.

## Output

- `citations.json` with per-question, per-engine results (cited urls, position, snippet, evidence link).
- `summary.md` with engine breakdown and Δ vs prior 14-day window.

## Behaviour

- Concurrency capped by SiteConfig `rate_limits.track_citations_per_minute`.
- Defaults to ToS-clean engines only; Playwright fallback requires `--use-playwright` and a user-owned session.
- Screenshot evidence files are stored under `.llm-seo-lab/evidence/<timestamp>/`.

## Stop conditions

- If `--scope=pr:NN` and the PR has no associated audits, refuse and ask the user to run /aeo:audit first.
- If oracle_query also fails for a question after retry, mark it `inconclusive` and continue.
