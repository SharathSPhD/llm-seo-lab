---
name: pull:state
description: Pretty-print the full state history for a use case — current stage, every event, every recommendation/application/measurement/analysis to date.
argument-hint: "use_case_id=<id>"
allowed-tools: Bash
---

You are running `pull:state` for the **llm-seo-lab** plugin (v0.3.0).

`$ARGUMENTS`: required `use_case_id`.

## Step 1 — load the bundle

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_use_case_state '{"use_case_id":"<USE_CASE_ID>"}'
```

This returns a `UseCaseStateBundle` with:

- `use_case` — the row itself (id, url, substrate, title, topic, current_stage, current_iteration, …).
- `events[]` — every transition (from_stage, to_stage, iteration, payload, created_at).
- `recommendations[]`, `applications[]`, `measurements[]`, `analyses[]` — full history.

Refuse to continue if the call fails. Surface the error envelope verbatim.

## Step 2 — render the state

Print these sections in order:

1. **Header** — `use_case_id`, URL, substrate, current stage, current iteration.
2. **Stage timeline** — one line per `events[]` row: `<created_at>  <from_stage> → <to_stage>  iter=<n>  payload.trigger=<…>`. Most-recent last.
3. **Iteration breakdown** — for each iteration `i` from `0` to `current_iteration`:
   - `recommendations[]` for iter `i`: knob + applicability_score + first 80 chars of rationale.
   - `applications[]` for iter `i`: artifact_kind + artifact_summary.
   - `measurements[]` for iter `i`: engine + citation_present + position.
   - `analyses[]` for iter `i`: verdict + next_iteration_suggestion (first 120 chars).
4. **Suggested next action** — based on `current_stage`, print the slash command the user should run next:
   - `DRAFT` / `ANALYZED` → `/pull:recommend use_case_id=<ID>`
   - `RECOMMENDED` → `/pull:apply use_case_id=<ID> rec_id=<…>` (the dashboard's `Mark applied` button is the actual mutator)
   - `APPLIED` → "Republish the page, then click **Republished** in the dashboard."
   - `REPUBLISHED` → "Click **Start measuring** in the dashboard, then run `/pull:measure use_case_id=<ID>`."
   - `MEASURING` → "Submit observations in the dashboard, then click **Submit observations** to advance to MEASURED."
   - `MEASURED` → `/pull:analyze use_case_id=<ID>`
   - `ABANDONED` → "Use case is closed."

## Stop conditions

- `read_use_case_state` returns `NOT_FOUND` → tell the user to confirm the use case id in the dashboard.

## Notes

`/pull:state` is **read-only**. It never writes to Supabase, never advances the stage, never calls Claude. Use it freely from any context (CI, dashboard server actions, or interactive sessions) without worrying about side effects.
