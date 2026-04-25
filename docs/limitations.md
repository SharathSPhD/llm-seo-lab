# Known limitations — `llm-seo-lab` v0.2.0

This file is the honest counterweight to the marketing copy in
`README.md`. If you read both, you should be able to predict exactly
what works end-to-end today and what is still scaffolding.

## 1. Citation tracking is a stub

The `track_citations` MCP tool and the Playwright browser automation
under `mcp/src/clients/playwright.ts` are **placeholders**. They
return deterministic synthetic data so the dashboard, the cli-worker,
and the analytics pipeline can be exercised end-to-end without
hitting real engines.

**Why it is still a stub:**
- Each engine (Perplexity, ChatGPT, Gemini, Google AIO, Claude.ai) needs
  its own session-handling, captcha defense, and answer-extraction
  logic. We did not want to ship a half-implemented version that
  produces real-looking-but-wrong data.
- The cited Phase 6 benchmarking results (`benchmarks/runs/local/`) are
  Bernoulli simulations calibrated against the GEO survey midpoint —
  they are useful for validating the *statistical pipeline*, not for
  claiming a real lift number.

**Implication for users:** the closed loop *opens a real PR* with real
brief content. The *T+14 lift measurement step is on hold* until the
Playwright crawler is real. Mark expected lift in the PR body and
revisit manually for now.

## 2. Audit and brief content can fall back to a deterministic stub

`audit_page` and `generate_brief` invoke `claude --print`. If the
Claude CLI fails (timeout, missing binary, non-JSON response), both
tools return a deterministic fallback object marked
`claude_model: "fallback-stub"` so the loop can still produce a
reviewable PR.

This is a **feature**: the architecture review explicitly demanded that
the loop must always be able to make forward progress and produce
something a human reviewer can accept or reject. It is also a
**caveat**: a `fallback-stub` brief is a Tier-1 templated
recommendation, not Claude reading your page HTML.

The first live run (PR #1 in
[`docs/use-cases/P3-live-run-2026-04-25/`](use-cases/P3-live-run-2026-04-25/README.md))
landed with stub content because the bare-`page_url` invocation we
sent did not produce a fenced JSON block. Future runs that pass real
`page_html` to `audit_page` and `generate_brief` will get real
content; the schema is identical either way.

## 3. The Pratyakṣa Buddhi gate degrades to no-op without `uv`

If `uv` is not on `PATH` when the cli-worker daemon starts, the loop
does not crash — it instantiates `NoopPratyakshaClient`, which always
reports "no conflicts, no sublations" and lets every brief through.
The loop runner records `pratyaksha_available: false` in
`LoopRunnerResult.buddhi` so this state is visible after the fact.

## 4. The Cursor marketplace listing is alpha-only

`v0.2.0` ships the dual-target plugin manifest, but the marketplace
publication step is intentionally deferred. Install via `/plugin
marketplace add` against the local repo path, as documented in
`README.md` — that is the supported install path until the plugin
graduates to a tagged marketplace listing.

## 5. Only one Phase-7 site has a captured live run

The plan describes five Phase-7 validation sites. This release ships
the first real PR against `sharathsphd.github.io` (PR #1). The
pattern reused for the other four is identical — drop a
`data/sites/<id>/config.json`, run `scripts/aeo-live-run.mjs --site
<id>` — but the evidence package is intentionally one site for this
sweep.

## 6. No API-key fallback. Subscription Claude CLI only.

This is a *constraint*, not a bug. The architecture is structured
around the user's Claude Code CLI subscription. Adding API-key
fallbacks would change the cost model and the Sākṣī invariant
(`subscription-only Claude CLI; no API keys, ever`) and is out of
scope.

## 7. T+14 citation lift is not measured in this release

Recording T0 baselines is implemented (each PR carries
`pre_audit_id` in its body). Re-running the loop after a PR merges
to capture T+1d, T+7d, T+14d deltas is the next round of work and
depends on (1) above being un-stubbed.
