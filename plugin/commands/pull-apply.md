---
name: pull:apply
description: Build the substrate-specific apply artifact for a single recommendation (PR diff for web, paste-ready Markdown for Substack, copy-paste checklist for YouTube). Does NOT auto-publish.
argument-hint: "use_case_id=<id> rec_id=<recommendation_id>"
allowed-tools: Bash
---

You are running `pull:apply` for the **llm-seo-lab** plugin (v0.3.0).

`$ARGUMENTS` is space-separated `key=value`. Required: `use_case_id`, `rec_id`.

## Step 1 — fetch the artifact

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" pull_apply_artifact \
  '{"use_case_id":"<USE_CASE_ID>","recommendation_id":"<REC_ID>"}'
```

The handler picks the right substrate adapter from `plugin/scripts/adapters/` and returns:

- `artifact_kind`: `pr_diff` (web), `paste_markdown` (substack), or `youtube_checklist` (youtube).
- `primary`: the artifact body (a unified diff, a Markdown block, or a YouTube-Studio checklist).
- `ancillary.knob`, `ancillary.voice_profile`: knob + voice metadata.
- `human_steps`: the ordered checklist the user follows next.

This call **does not persist anything**. The `applications` row only gets written when the user clicks `Mark applied` in the dashboard. The plugin's job is to surface the artifact, not to commit it.

## Step 2 — render the artifact for the user

Print the artifact in the most useful form for the substrate:

- **`pr_diff`** — print the diff inside a `\`\`\`diff` fence, then the human steps as a numbered list. Do not run `git apply` — let the user choose between paste-into-editor and `git apply -p0`.
- **`paste_markdown`** — print the markdown inside a `\`\`\`markdown` fence so the user can copy verbatim. Note the voice profile.
- **`youtube_checklist`** — print each `[ ]` line on its own line so the user can tick them off field-by-field in YouTube Studio.

Always end with:

> Next: edit the page, republish, then click **Mark applied** in the dashboard. The dashboard will call `record_use_case_event` to advance the stage to `APPLIED`. Direct CLI users can call `/pull:state use_case_id=<ID>` to confirm the transition.

## Stop conditions

- `pull_apply_artifact` returns `NOT_FOUND` for the recommendation → tell the user the recommendation id does not belong to this use case (often a stale dashboard tab; suggest reloading).
- The use case is not in `RECOMMENDED` stage → warn the user but still surface the artifact (an artifact is read-only; the stage gate is in the dashboard, not the artifact builder).

## Hard rule

`/pull:apply` MUST NOT call `record_use_case_event`. The stage transition `RECOMMENDED → APPLIED` is the *user's signal that they have done the work*. Auto-advancing it on artifact build would lie in the audit trail.
