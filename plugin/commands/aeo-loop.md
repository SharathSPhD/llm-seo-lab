---
name: aeo:loop
description: Run the full closed loop - audit → fix (PR) → wait for merge → track lift → log result. Calls the aeo-loop agent.
args:
  - name: budget_questions
    type: number
    required: false
    description: Max questions to use for tracking lift (default 200, hard cap 1000).
  - name: max_iterations
    type: number
    required: false
    description: Max audit/fix iterations before stopping (default 3).
---

# /aeo:loop

Hand control to the `aeo-loop` agent for one full closed-loop iteration.

## What this does

The agent will:

1. Run `/aeo:audit` (entire site or last touched pages, configurable).
2. Pick the top N gaps by `predicted_lift_pp`, capped by `pr_policy.max_gaps_per_pr`.
3. Run `/aeo:fix` to open a PR and record `pr_id` + `pre_audit_id` in `.llm-seo-lab/prs/<pr_id>.json`.
4. Stop and surface the PR for human review and merge.
5. After merge (signaled by the `on-pr-merge` hook firing or by the user re-invoking `/aeo:loop --continue=pr:NN`):
   - Wait `pr_policy.measurement_window_days` (default 14).
   - Run `/aeo:track --scope=pr:NN`.
   - Compute Δ citation share per engine vs the pre-PR baseline.
   - Compute statistical significance (two-proportion z-test, Bonferroni across engines).
   - Write `.llm-seo-lab/results/pr-<pr_id>.json` and append to `docs/use-cases/<site_id>-loop-log.md`.
6. Exit cleanly. Do not chain to a second iteration without explicit user approval.

## Behaviour

- One open PR per site at a time.
- Always pauses for human review at the PR step.
- Honours `evidence_policy.require_tier_1_only`.
- Writes a `loop-summary.md` per iteration for the dashboard.

## Stop conditions

- max_iterations reached.
- All Tier-1 gaps closed (no qualifying gaps in the latest audit).
- Quota exhausted on the Claude CLI subscription.
