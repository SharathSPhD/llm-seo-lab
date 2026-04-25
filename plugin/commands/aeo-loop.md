---
name: aeo:loop
description: Run the full closed loop — audit → fix (PR) → wait for merge → track lift — for one site. Hands control to the aeo-loop agent.
argument-hint: "site_id=<id> [max_iterations=<n>]"
allowed-tools: Bash, Task
---

You are running `aeo:loop` for the **llm-seo-lab** plugin.

`$ARGUMENTS` is space-separated `key=value`. Required: `site_id`. Optional: `max_iterations` (default 1, hard cap 3 — never iterate without explicit user re-approval).

## Why this command exists

The loop has three phases — automated audit/fix, human PR review, and post-merge measurement. The first and third phases are agent work; the middle is a deliberate human checkpoint. We refuse to chain past it without consent.

## Step 1 — confirm pre-conditions

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_config '{"site_id":"<SITE_ID>"}'
```

Refuse to continue if this errors. Fall back to `/aeo:bootstrap`.

Tell the user exactly what will happen and how many iterations they have approved. Wait for `proceed`.

## Step 2 — delegate to the aeo-loop agent

The `aeo-loop` agent owns the audit → fix → PR pipeline. Hand off:

```
@aeo-loop site_id=<SITE_ID> max_iterations=<N>
```

(In Cursor and Claude Code this fires the agent registered at `agents/aeo-loop.md`.)

## Step 3 — surface the agent's output

When the agent returns, print:

- The PR URL (if a PR was opened)
- The audit IDs and brief IDs touched
- The recommended next step (`merge the PR`, `wait 14 days`, or `re-run /aeo:loop --continue=pr:<id>`)

## Stop conditions

- `read_config` errors — defer to `/aeo:bootstrap`.
- The agent reports `no_qualifying_gaps` — print and stop.
- The user has already merged a prior PR — recommend `/aeo:track scope=pr:<id>` instead of opening another PR.
- Quota exceeded on the Claude CLI subscription — stop, do not retry.
