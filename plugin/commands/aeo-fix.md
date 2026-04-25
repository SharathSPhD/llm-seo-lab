---
name: aeo:fix
description: Turn an audit's top gaps into a small, reviewable PR. Drafts revised page sections via the content-brief-from-gap skill, emits JSON-LD via the schema-generator skill, opens a PR via the open_pr MCP tool.
args:
  - name: audit_path
    type: string
    required: false
    description: Path to a specific .llm-seo-lab/audits/<ts>/audits.json. Defaults to the most recent one.
  - name: max_gaps
    type: number
    required: false
    description: Maximum number of gaps to address in this PR (default 3, hard cap 5 to keep PRs reviewable).
---

# /aeo:fix

Convert audit findings into a small PR.

## What this does

1. Loads the most recent audits.json (or the one passed via `--audit-path`).
2. Filters gaps to Tier-1, predicted_lift_pp >= `evidence_policy.min_predicted_lift_pp`, and at most `max_gaps`.
3. For each surviving gap:
   - Calls MCP tool `generate_brief` (delegates to `content-brief-from-gap` skill) to draft the revised section.
   - If the gap is `add_schema_markup`, also calls MCP tool `emit_schema` (delegates to `schema-generator` skill) to produce JSON-LD.
4. Stages the diff in a fresh branch `aeo-fix/<timestamp>`.
5. Calls MCP tool `open_pr` with title and body templated from the gap list, including:
   - Predicted lift per gap.
   - GEO-paper reference per gap.
   - The `pre_audit_id` field linking back to audits.json.
6. Records the PR id in `.llm-seo-lab/prs/<pr_id>.json` for the on-pr-merge hook.

## Behaviour

- Refuses to open more than one open PR per site at a time (configurable via SiteConfig `pr_policy.max_open_prs`).
- Default branch base = `main`; override via `--base`.
- Uses the human-voice guard from the `content-brief-from-gap` skill: brief instructs the writer to preserve voice, not flatten it.
- Substack/Ghost/Webflow substrates: instead of opening a PR, generate a `.llm-seo-lab/drafts/<gap_id>.md` and stop with a "manual publish required" message.

## Stop conditions

- If `evidence_policy.require_tier_1_only` is true and zero Tier-1 gaps remain, exit with a "no qualifying gaps" message.
- If git is dirty, refuse to start without `--allow-dirty`.
