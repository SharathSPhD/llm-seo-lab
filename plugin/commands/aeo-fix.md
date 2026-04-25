---
name: aeo:fix
description: Turn an audit's top Tier-1 gaps into a small reviewable PR via the cli-worker loop runner.
argument-hint: "site_id=<id>"
allowed-tools: Bash
---

You are running `aeo:fix` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is space-separated `key=value`. Required: `site_id`.

This command **delegates to the cli-worker loop runner**, which already implements the full audit→filter→brief→PR pipeline and writes per-step artefacts to `data/sites/<site_id>/`.

## Step 1 — confirm the SiteConfig is healthy

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config '{"site_id":"<SITE_ID>"}'
```

Refuse to continue if this errors.

Read back the `seed_pages` and `max_gaps_per_pr` fields. Tell the user how many pages will be audited and how many gaps will be bundled at most.

## Step 2 — submit a loop job to the cli-worker daemon

The cli-worker daemon listens on `http://127.0.0.1:7300` (override via `LLM_SEO_LAB_CLI_WORKER_URL`). Submit a job:

```bash
CLI_WORKER_URL="${LLM_SEO_LAB_CLI_WORKER_URL:-http://127.0.0.1:7300}"
curl -sS -X POST "${CLI_WORKER_URL}/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"aeo_loop","site_id":"<SITE_ID>","payload":{"site_id":"<SITE_ID>"}}'
```

The response contains a `job_id`. Poll until the job terminates:

```bash
curl -sS "${CLI_WORKER_URL}/jobs/<JOB_ID>"
```

Each poll returns the job status (`queued|running|succeeded|failed`) and a streamed list of progress events.

## Step 3 — print the loop result

When the job finishes:

- On `succeeded`: print the `LoopRunnerResult` (PR URL if a PR was opened, the brief IDs, the audit IDs, `next_step`).
- On `no_qualifying_gaps`: tell the user there are no Tier-1 gaps clearing the evidence floor — suggest re-auditing more pages or relaxing `min_predicted_lift_pp`.
- On `failed`: surface the error envelope verbatim — do **not** mask `QUOTA_EXCEEDED` or `NETWORK` errors.

## Stop conditions

- cli-worker daemon unreachable — tell the user to start it (`npm run start --workspace=cli-worker`).
- `read_config` errors — fall back to `/aeo:bootstrap`.
- Job ends with status `failed` and a non-retryable error code — surface and stop.
