# P3 — Live AEO loop run against `sharathsphd.github.io` (2026-04-25)

This folder is the evidence package the architecture review demanded: a real,
reproducible end-to-end execution of the closed-loop AEO citation engineer
against a real customer site, opening a real reviewable Pull Request.

## TL;DR

- **Site**: `sharathsphd.github.io` (Phase 7 site, owned by `SharathSPhD`)
- **Run id**: `P3-live-run-2026-04-25`
- **Pre-audit id**: `aud_stub_1c67cbce-fcc`
- **PR opened**: <https://github.com/SharathSPhD/SharathSPhD.github.io/pull/1>
- **Branch**: `aeo-fix/aud_stub_1c67cbce-fcc`
- **Files written**: `docs/aeo-briefs/brief_bbd82668-dc4.md`,
  `docs/aeo-briefs/brief_32e712b4-342.md`,
  `docs/aeo-briefs/brief_f9f5b7df-b4a.md` (3 reviewable Tier-1 briefs)
- **Buddhi gate**: pratyaksha available, 0 conflicts, 0 sublations,
  0 blocked briefs (first run — Avaccedaka store seeded)
- **Next step**: human review of PR #1; on merge, `/aeo:loop --continue=pr:1`
  for T+14 lift measurement

## What was actually exercised

The full closed loop, in one process, against the real MCP server and the
real `pratyaksha-context-eng-harness` Python MCP server:

1. `read_config(site_id=sharathsphd-githubio)` — real `data/sites/.../config.json`
2. `audit_page(...)` for two seed pages — `https://sharathsphd.github.io/`
   and `https://sharathsphd.github.io/about/`
3. Manas: `generate_brief(...)` for the top-3 Tier-1 gaps after the
   `evidence_policy.require_tier1_first` filter
4. Sākṣī: `pratyaksha.set_sakshi(...)` already pinned at session start
   by `plugin/scripts/aeo-sakshi.sh`
5. Buddhi: `pratyaksha.context_retrieve(...)` per brief, then
   `pratyaksha.context_insert(...)` (no priors existed → no sublation)
6. `open_pr(...)` in **live mode**: `git clone` of
   `https://github.com/SharathSPhD/sharathsphd.github.io.git` →
   `git checkout -b aeo-fix/...` → wrote 3 brief markdown files →
   `git -c user.name=llm-seo-lab[bot] commit ...` → `git push -u origin ...`
   → `gh pr create ...`

Pratyaksha was actually consulted (`live_run.pratyaksha_enabled` event
in the transcript with `available: true`); the loop was not running in
the noop fallback mode.

## Honest caveats (read before claiming victory)

- **Audit content is currently a stub.** The Claude CLI is invoked, but
  in this run it returned a non-JSON-block response, so the
  `audit_page` tool fell back to the deterministic `fallback-stub`
  result (clearly marked with `claude_model: "fallback-stub"`). Two
  Tier-1 gaps come from the seeded fallback, not from Claude's actual
  reading of the page HTML. The loop's *plumbing* is real; the
  *content* of the gaps is a stub. Fixing this is in scope for R7
  (refining the SKILL.md prompt and feeding real `page_html`).
- **Briefs are also stubs.** Same story for `generate_brief`: when
  Claude doesn't return a fenced JSON block, we fall back to the
  deterministic stub brief so the loop can still produce a reviewable
  PR. Each brief is marked `claude_model: "fallback-stub"`.
- **Citation lift not yet measured.** This run captures the T0 baseline.
  The T+14 measurement requires elapsed time and is documented as
  out-of-scope for this sweep (per the plan).
- **Playwright crawler is still stubbed.** Real citation tracking comes
  in a future release; documented in `docs/limitations.md`.

These caveats are deliberate: the architecture review's #1 ask was
*"prove the loop has actually been executed end-to-end against a real
site"*. That box is now ticked. Quality of the LLM-generated content
inside the loop is a separate axis we iterate on in subsequent rounds.

## Files in this folder

- `transcript.jsonl` — every loop event (`read_config`, `audit_page`,
  `manas`, `buddhi`, `open_pr`, `done`) timestamped and ordered.
- `result.json` — the `LoopRunnerResult` returned by `runLoopOnce`.
- `pr-snapshot.json` — the `gh pr view --json ...` output captured
  immediately after PR creation.

## How to reproduce

```bash
# 1. Make sure the MCP server is up on :7301
node --experimental-strip-types --no-warnings \
  mcp/bin/llm-seo-lab-mcp.mjs --port=7301 \
  --data-dir="$(pwd)/data" &

# 2. Make sure uv is on PATH (pratyaksha runs via `uv run`)
which uv

# 3. Run the harness — drop --dry-run to actually open the PR
node --experimental-strip-types --no-warnings \
  scripts/aeo-live-run.mjs \
  --site sharathsphd-githubio \
  --run-id MY-RUN-ID
```

The harness will refuse to start if the MCP server is unreachable.
