# llm-seo-lab v0.3.0 — Implementation Plan (in-repo canonical)

**Date:** 2026-04-26 · **Phase:** v0.3.0 R1 · **Status:** plan canonicalised · **Anchors:** [`prd.md`](prd.md), [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), `/Users/<user>/.cursor/plans/v0.3.0_citation-pull_reorientation_30143e16.plan.md` (Cursor-side master plan, NOT to be edited).

This is the in-repo mirror of the master plan that lives outside the repo at `~/.cursor/plans/v0.3.0_citation-pull_reorientation_30143e16.plan.md`. It is reproduced here in full so the repo is self-contained for anyone reading the v0.3.0 documentation; the master plan in `~/.cursor/plans/` remains the canonical source for Cursor's todo machinery and is not edited by R1-R7.

---

## Locked decisions (verbatim)

- **Same monorepo**, existing [`plugin/`](../../plugin/) is **updated** in place. `/aeo:*` competitor-gap commands stay; new `/pull:*` mode is added alongside.
- **Supabase** (Auth + Postgres + RLS) for the dashboard backend. The auth seam at [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) was already designed for a swap; we make it real.
- **Measurement leaves the plugin.** `track_citations`, `read_citation_trend`, and the Playwright crawler stub are deprecated in product flow (kept code-only as archive). Phase 6 simulation benchmark is archived. **Users self-report engine observations and analytics in the dashboard.**
- **Time-spread state machine.** Every stage transition is human-triggered via the dashboard. Backend (plugin + Claude CLI via MCP) only runs on transitions.
- **Three real seed use cases**: `www.technektar.dev` (web), `https://technektar.substack.com/p/when-the-context-window-is-big-and?r=7dqlgi` (Substack), `https://youtu.be/fM2hpqPx8zg?si=mAnjJkN1miAhFLem` (YouTube). All three substrates are first-class.
- **Plugin & Cursor manifests bump to v0.3.0** ([`plugin/.claude-plugin/plugin.json`](../../plugin/.claude-plugin/plugin.json), [`plugin/.cursor-plugin/plugin.json`](../../plugin/.cursor-plugin/plugin.json)).
- **Existing v0.2.0 artifacts stay frozen.** No edits to [`project-overview.html`](../../project-overview.html), [`CHANGELOG.md`](../../CHANGELOG.md) v0.2.0 entry, or v0.2.0 ralph reports. v0.3.0 lands as additive sections + new ralph reports R1-R7 under a v0.3.0 namespace.

## R-phase chunking

| Phase | Theme | Closes with |
|---|---|---|
| R1 | Document-first reorientation (PRD, spec, architecture, plan, migration) | [`docs/ralph-runs/v0.3.0/R1.md`](../../docs/ralph-runs/v0.3.0/R1.md) |
| R2 | TRIZ + attractor-flow + Pratyakṣa charter for citation-pull | [`docs/ralph-runs/v0.3.0/R2.md`](../../docs/ralph-runs/v0.3.0/R2.md) |
| R3 | Supabase schema + RLS + MCP read/write tools | [`docs/ralph-runs/v0.3.0/R3.md`](../../docs/ralph-runs/v0.3.0/R3.md) |
| R4 | Substrate adapters (web, substack, youtube) | [`docs/ralph-runs/v0.3.0/R4.md`](../../docs/ralph-runs/v0.3.0/R4.md) |
| R5 | Plugin commands + pull-orchestrator agent + manifests bumped | [`docs/ralph-runs/v0.3.0/R5.md`](../../docs/ralph-runs/v0.3.0/R5.md) |
| R6 | Frontend (multi-user, stage-driven dashboard) | [`docs/ralph-runs/v0.3.0/R6.md`](../../docs/ralph-runs/v0.3.0/R6.md) |
| R7 | Seed three live use cases + verify + tag v0.3.0 | [`docs/ralph-runs/v0.3.0/R7.md`](../../docs/ralph-runs/v0.3.0/R7.md) |

## Surface delta (after v0.3.0)

| Surface | What changes | What stays |
|---|---|---|
| [`plugin/`](../../plugin/) | New `/pull:*` commands; new `pull-orchestrator` agent; substrate adapters for `web`, `substack`, `youtube`. Manifests bump to 0.3.0 | All `/aeo:*` commands; existing hooks (Sākṣī); `aeo-mcp.sh` |
| [`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts) | Adds `pull_recommend`, `pull_apply_artifact`, `pull_analyze`, `read_use_case_state`, `record_use_case_event`. Deprecates `track_citations`, `read_citation_trend` (kept registered, return `{ok:false, error:"deprecated_v0.3.0"}`) | All other 14 tools |
| [`apps/web/`](../../apps/web/) | Real Supabase client; `/login`, `/dashboard`, `/use-cases`, `/use-cases/[id]` with stage UI; user-reported measurement form; replaces sites-centric routes | Layout chrome, widget components (re-skinned) |
| `data/use-cases/<id>/` (new) | Per-use-case state JSON mirror (for offline/git history) | n/a |
| `data/sites/` | Frozen for v0.2.0 use; not touched by v0.3.0 flow | Existing `sharathsphd-githubio/config.json` |
| `benchmarks/` | Archived (README pointer); no new runs | Existing artifacts |

## Files to create

- `docs/v0.3.0/{prd,spec,architecture,plan,migration}.md` (this directory; created in R1)
- `docs/triz/v0.3.0-pull-contradictions.md`, `…-pull-ariz.md`, `…-pull-finalists.md`, `…-pull-attractor.json`, `…-pratyaksha-deltas.md` (R2)
- `docs/decisions/2026-04-26-citation-pull-charter.md` (R2)
- `docs/ralph-runs/v0.3.0/R1.md` … `R7.md` (one per phase)
- `infra/supabase/migrations/0001_init.sql` (R3)
- `apps/web/lib/supabase/{server,client}.ts` (R3)
- `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/use-cases/{new,[id],[id]/measurements/new}/page.tsx` (R6)
- `plugin/commands/pull-{recommend,apply,measure,analyze,state}.md` (R5)
- `plugin/agents/pull-orchestrator.md` (R5)
- `plugin/scripts/adapters/{web,substack,youtube}.ts` (R4)
- `data/use-cases/{u1-technektar-dev,u2-technektar-substack-context-window,u3-youtube-fM2hpqPx8zg}/{config.json,state.jsonl}` (R7)

## Files to modify

- [`plugin/.claude-plugin/plugin.json`](../../plugin/.claude-plugin/plugin.json), [`plugin/.cursor-plugin/plugin.json`](../../plugin/.cursor-plugin/plugin.json) — bump to 0.3.0; description; new commands listed
- [`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts) — register the 5 new tools; deprecation envelopes on `track_citations` (line 600) and `read_citation_trend` (line 898)
- [`mcp/src/server.ts`](../../mcp/src/server.ts) — wire new tools
- [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) — replace shim with Supabase implementation; preserve `AuthUser` interface
- [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx) — landing routes to `/dashboard` when signed in, `/login` otherwise
- [`apps/web/components/nav.tsx`](../../apps/web/components/nav.tsx) — add Use Cases nav, sign-out
- [`apps/web/package.json`](../../apps/web/package.json) — add `@supabase/ssr`, `@supabase/supabase-js`
- [`scripts/aeo-live-run.mjs`](../../scripts/aeo-live-run.mjs) — gain a `--use-case` mode for the new flow
- [`README.md`](../../README.md), [`CHANGELOG.md`](../../CHANGELOG.md) — additive v0.3.0 entries
- [`scripts/install.sh`](../../scripts/install.sh) — verify Supabase CLI optional, document `SUPABASE_URL`/`SUPABASE_ANON_KEY`

## Files NOT to touch

- [`project-overview.html`](../../project-overview.html) v0.2.0 sections (additive only at the end of R7)
- v0.2.0 ralph reports `docs/ralph-runs/R1.md..R7.md`
- v0.2.0 use-case reports `docs/use-cases/P1..P5*.md`, `docs/use-cases/P3-live-run-2026-04-25/`
- The Cursor-side plan file `~/.cursor/plans/v0.3.0_citation-pull_reorientation_30143e16.plan.md`

## Out of scope for v0.3.0

- Auto-scraping any AI engine for citation observations (explicitly removed)
- Hosting the dashboard on Vercel (local-first; cloud deploy is v0.4.0)
- Auto-publishing to Substack or YouTube (we generate paste-ready artifacts only)
- A Cursor marketplace listing for the v0.3.0 plugin (still alpha)
- Re-running Phase 6 simulation benchmarks
- Any work on `tools/attractor-flow/` or `tools/pratyaksha/` submodules (consumed as-is via MCP)

## Verification gates (before declaring v0.3.0 GREEN in R7)

1. All v0.2.0 tests still pass (`npm test` across `mcp/`, `apps/web/`, `packages/cli-worker/`).
2. New tests pass for the 5 new MCP tools and the 3 substrate adapters.
3. Supabase migration applies cleanly to a fresh local Postgres + a Supabase project; RLS verified by a deny-test.
4. Three use cases visible in the dashboard for a real signed-in user; each has at least one stage event in `use_case_events`.
5. At least one use case has ≥3 measurement rows from at least 2 different engines.
6. `pull_analyze` produces a non-stub `analyses` row that cites at least one TRIZ principle and one attractor-flow metric from the use case's history.
7. `/aeo:loop` still runs end-to-end on the v0.2.0 `sharathsphd-githubio` site (regression check).
8. [`README.md`](../../README.md) quickstart works on a clean clone (Supabase env vars + `claude` on PATH + `npm i` + `supabase db push` + `npm run dev`).
9. [`project-overview.html`](../../project-overview.html) v0.3.0 section loads (verified via `python3 -m http.server`); all new doc panels resolve.
