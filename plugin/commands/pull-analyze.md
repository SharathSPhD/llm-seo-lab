---
name: pull:analyze
description: Compute a verdict for the latest iteration's measurements (improved/stable/regressed/inconclusive); persist an Analysis row and suggest the next iteration.
argument-hint: "use_case_id=<id> [iteration=<n>] [user_id=<id>]"
allowed-tools: Bash
---

You are running `pull:analyze` for the **llm-seo-lab** plugin (v0.3.0).

`$ARGUMENTS`: required `use_case_id`. Optional `iteration` (defaults to current), `user_id` (defaults to the use case owner).

## Step 1 — confirm the use case is ready to analyze

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_use_case_state '{"use_case_id":"<USE_CASE_ID>"}'
```

Refuse to continue unless the use case is in `MEASURED` (or the user explicitly passes `--force`, which the plugin does not currently expose; in that case stop and tell them).

## Step 2 — run the analysis

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" pull_analyze \
  '{"use_case_id":"<USE_CASE_ID>","user_id":"<USER_ID>","iteration":<N>}'
```

The handler:

- Loads `measurements` for the requested iteration and the previous iteration.
- Computes per-engine citation share and an overall delta. With no prior iteration, the verdict is `inconclusive` and the suggestion is to establish a baseline.
- Calls Claude (`pull-analyze` skill) for a richer next-iteration suggestion + attractor metrics; falls back to a deterministic verdict on parse failure.
- Inserts the row into `analyses` and returns it.

## Step 3 — record the stage transition

If the analysis succeeded and the use case was in `MEASURED`, advance to `ANALYZED`:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" record_use_case_event \
  '{"use_case_id":"<USE_CASE_ID>","user_id":"<USER_ID>","to_stage":"ANALYZED","payload":{"trigger":"pull:analyze","analysis_id":"<ID>","verdict":"<VERDICT>"}}'
```

(As with `/pull:recommend`, the dashboard normally records the transition itself when the user clicks `Analyze`. Step 3 is for direct CLI usage and idempotent — `record_use_case_event` rejects illegal transitions with `INVALID_INPUT`.)

## Step 4 — print the verdict + next-iteration plan

Print:

- `verdict` (improved / stable / regressed / inconclusive / stub).
- `per_engine_delta` as a table (engine | share_current | share_previous | delta).
- `triz_principles_cited` as a comma-separated list.
- `next_iteration_suggestion` (Claude-derived where possible).
- `attractor_metrics` if non-null (FTLE / basin / goal-distance).

End with the suggested next command:

> Run `/pull:recommend use_case_id=<ID>` to start iteration `<N+1>` with the suggestions above as the seed. Or click **Next iteration** in the dashboard to do the same.

## Stop conditions

- `pull_analyze` returns `inconclusive` because of zero current measurements → tell the user to record at least one observation in the dashboard before re-analyzing. Do not auto-advance the stage.
- `INVALID_INPUT` on cross-user calls → never auto-retry.
- Verdict `stub` (Claude parse fail and no measurements at all) → still advance the stage, but flag in the printed output that the verdict is a fallback.
