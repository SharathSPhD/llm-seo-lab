---
name: pull:recommend
description: Generate citation-pull recommendations for a use case (TRIZ charter × substrate adapter); persists rows to Supabase and surfaces them.
argument-hint: "use_case_id=<id> [iteration=<n>] [user_id=<id>]"
allowed-tools: Bash
---

You are running `pull:recommend` for the **llm-seo-lab** plugin (v0.3.0 citation-pull mode).

`$ARGUMENTS` is space-separated `key=value`. Required: `use_case_id`. Optional: `iteration` (defaults to the use case's `current_iteration`), `user_id` (defaults to the use case's owner — but the dashboard always passes the authenticated user's id).

## Step 1 — load the use-case state

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_use_case_state '{"use_case_id":"<USE_CASE_ID>"}'
```

This returns a `UseCaseStateBundle` with the `use_case` row, every event, every recommendation/application/measurement/analysis to date. Refuse to continue if the use case is not in `DRAFT` or `ANALYZED` (the only stages from which `/pull:recommend` is legal — see `docs/v0.3.0/spec.md` §3.2).

## Step 2 — generate recommendations

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" pull_recommend \
  '{"use_case_id":"<USE_CASE_ID>","user_id":"<USER_ID>","iteration":<N>}'
```

The MCP tool calls the substrate adapter (`web` / `substack` / `youtube`) for each of the five charter principles ratified in `docs/decisions/2026-04-26-citation-pull-charter.md`:

1. atomic-snippet-density
2. semantic-anchor-stability
3. q-shaped-subhead-lattice
4. cross-engine-intermediary
5. inverted-retrieval-target

The handler persists one `recommendations` row per principle and returns `{recommendations[], claude_run_id}`.

## Step 3 — record the stage transition

If the use case was in `DRAFT` or `ANALYZED`, advance it to `RECOMMENDED`:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" record_use_case_event \
  '{"use_case_id":"<USE_CASE_ID>","user_id":"<USER_ID>","to_stage":"RECOMMENDED","payload":{"trigger":"pull:recommend","claude_run_id":"<CLAUDE_RUN_ID>"}}'
```

(The dashboard normally calls `record_use_case_event` itself when the user clicks the action button. This step is only here for direct CLI invocations, not orchestrator-driven runs.)

## Step 4 — print the recommendation set

For each row in the response, print:

- `triz_principle`, `knob`, `applicability_score`, expected engines.
- The first ~200 chars of `rationale`.
- The voice profile carried in `payload.voice_profile`.

End with the suggested next command:

> The user should now open the dashboard, review each recommendation, click `Build artifact` on the one(s) they want to apply, then `Mark applied` once they've edited the page. Direct CLI users can run `/pull:apply use_case_id=<ID> rec_id=<REC_ID>` to fetch the artifact.

## Stop conditions

- `read_use_case_state` returns `NOT_FOUND` → tell the user to create the use case in the dashboard first.
- `pull_recommend` returns `INVALID_INPUT` (cross-user) → never auto-retry; the dashboard's auth layer should have caught it.
- `QUOTA_EXCEEDED` → surface `retry_after_seconds` and stop.
