# llm-seo-lab v0.3.0 — Migration Notes

**Date:** 2026-04-26 · **Phase:** v0.3.0 R1 · **Status:** migration plan · **Anchors:** [`prd.md`](prd.md), [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`plan.md`](plan.md)

This document tells anyone returning to the project after v0.2.0 what changes between v0.2.0 and v0.3.0 — what is frozen, what is replaced, what new dependencies are required, and how the two operating modes (`/aeo:*` and `/pull:*`) coexist.

---

## 1. What stays exactly as it was in v0.2.0

The following surfaces are **frozen**. v0.3.0 does not modify them; they continue to operate in v0.2.0 mode.

| Surface | Frozen artifact |
|---|---|
| Competitor-gap loop commands | [`plugin/commands/aeo-audit.md`](../../plugin/commands/aeo-audit.md), [`aeo-bootstrap.md`](../../plugin/commands/aeo-bootstrap.md), [`aeo-compete.md`](../../plugin/commands/aeo-compete.md), [`aeo-fix.md`](../../plugin/commands/aeo-fix.md), [`aeo-loop.md`](../../plugin/commands/aeo-loop.md), [`aeo-status.md`](../../plugin/commands/aeo-status.md), [`aeo-track.md`](../../plugin/commands/aeo-track.md) |
| Competitor-gap MCP tools | The 14 v0.2.0 tools other than `track_citations` and `read_citation_trend` in [`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts) |
| Pratyakṣa hooks | [`plugin/hooks/`](../../plugin/hooks/) Sākṣī / Manas / Buddhi wiring; the v0.3.0 R2 charter refines what these hooks check for, but does not change their structure |
| Site config substrate | [`data/sites/sharathsphd-githubio/config.json`](../../data/sites/sharathsphd-githubio/config.json) and any other entries under `data/sites/` |
| v0.2.0 documentation | All files under `docs/research/`, `docs/triz/` (v0.2.0 set), `docs/spec/2026-04-25-llm-seo-lab-design.md`, `docs/prd/llm-seo-lab-prd.md`, `docs/limitations.md` (v0.3.0 appends a section in R7), all `docs/ralph-runs/R1..R7.md`, all `docs/use-cases/P1..P5*` and `docs/use-cases/P3-live-run-2026-04-25/` |
| The single-page project overview | [`project-overview.html`](../../project-overview.html) — additive section group only at the very end of R7 |
| Repo-root release tag | `v0.2.0` tag stays as the v0.2.0 release evidence |

## 2. What is deprecated in product flow but kept as code

| Code | Status | Behaviour after v0.3.0 |
|---|---|---|
| `track_citations` MCP tool | Deprecated envelope | Returns `{ok:false, error:"deprecated_v0_3_0"}` |
| `read_citation_trend` MCP tool | Deprecated envelope | Returns `{ok:false, error:"deprecated_v0_3_0"}` |
| Playwright crawler stub at [`mcp/src/clients/playwright.ts`](../../mcp/src/clients/playwright.ts) | Frozen | Not invoked by any v0.3.0 path; v0.2.0 tests still cover it |
| Phase 6 simulation benchmark suite under [`benchmarks/`](../../benchmarks/) | Archived | A README pointer is added in R7; no new benchmark runs |
| Sites-centric routes in `apps/web/app/sites/*` | Mounted under "Archive" tab | Backwards-compat for the existing dogfood site; no functional changes |

A test in [`mcp/tests/v0.3.0.test.ts`](../../mcp/tests/v0.3.0.test.ts) (created in R3) asserts the deprecation envelope shape so a future commit cannot accidentally re-enable scraping.

## 3. What is new

| Surface | First introduced in |
|---|---|
| Supabase project + schema + RLS | R3 |
| `read_use_case_state`, `record_use_case_event`, `pull_recommend`, `pull_apply_artifact`, `pull_analyze` MCP tools | R3 |
| `web`, `substack`, `youtube` substrate adapters | R4 |
| `/pull:recommend`, `/pull:apply`, `/pull:measure`, `/pull:analyze`, `/pull:state` plugin commands | R5 |
| `pull-orchestrator` agent | R5 |
| Multi-user dashboard (`/login`, `/dashboard`, `/use-cases/*`) | R6 |
| User-reported measurement form | R6 |
| Three seed use cases under `data/use-cases/` | R7 |
| TRIZ + attractor-flow + Pratyakṣa charter for citation-pull | R2 |

## 4. New environment variables

```bash
# Required for v0.3.0 dashboard + MCP Supabase access
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key, browser-safe>
SUPABASE_SERVICE_ROLE_KEY=<service key, server-only>

# Optional escape hatch — disables Supabase auth, falls back to the v0.2.0 archive surfaces only
LLM_SEO_LAB_AUTH_ENABLED=1

# Optional — write a JSONL mirror of stage events under data/use-cases/<id>/state.jsonl
LLM_SEO_LAB_GIT_MIRROR=0

# Existing v0.2.0 vars (preserved)
MCP_HTTP_URL=http://localhost:7374
```

## 5. Coexistence: `/aeo:*` vs `/pull:*`

The two loops share the same MCP HTTP transport and the same Claude CLI binary. They do not share state.

- A user with **only** v0.2.0 sites (e.g. someone running the regression check against `sharathsphd-githubio`) sees no behavioural change. `/aeo:loop` continues to operate as before.
- A user with **only** v0.3.0 use cases interacts entirely through the dashboard and never invokes `/aeo:*`.
- A user with **both** can run them side-by-side. Recommendations from `pull_analyze` may suggest the user invoke `/aeo:loop` against a related site; this is a suggestion in the analyses row, not an automatic invocation.

There is no migration path from a `data/sites/` config to a `data/use-cases/` use case. The two are different model objects with different semantics. A user who wants to bring an old site under the v0.3.0 workflow creates a new use case via `/use-cases/new` pointing at the same URL.

## 6. Migration steps for an existing v0.2.0 install

1. `git pull` to v0.3.0.
2. Create a Supabase project at <https://supabase.com>. Free tier suffices.
3. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into `.env.local` at the repo root and into `apps/web/.env.local`.
4. Apply the schema:
   ```bash
   supabase db push --db-url "postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
   ```
   (The exact command appears in [`README.md`](../../README.md) §quickstart after R7.)
5. `npm install` at the repo root (picks up `@supabase/supabase-js` and `@supabase/ssr`).
6. Restart the MCP server: `bash plugin/scripts/aeo-mcp.sh restart`.
7. `npm run dev` in `apps/web/`.
8. Open `http://localhost:3030`, sign in via magic-link, create a use case.

For a regression check that v0.2.0 still works:

```bash
cd /path/to/repo
node scripts/aeo-live-run.mjs --site sharathsphd-githubio --dry-run
```

This must exit 0 with the same artifacts as v0.2.0 emitted.

## 7. Backwards compatibility commitments

- The MCP HTTP wire format for the v0.2.0 tools does not change.
- The `AuthUser` interface in [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) is preserved (the implementation changes; the export signature does not). Existing widget imports compile unchanged.
- The `data/sites/<site>/config.json` schema is preserved.
- Plugin command file naming convention (`<verb>-<noun>.md`) is preserved.

## 8. Forward-compatibility seams (anticipating v0.4.0)

- The Supabase service-role key is referenced through a single `mcp/src/clients/supabase.ts` module so it can be swapped for a multi-tenant access broker in v0.4.0 without touching tool code.
- The substrate-adapter interface (see [`spec.md`](spec.md) §2) is stable so v0.4.0 can add a `wordpress` or `notion` adapter by dropping in a new file under `plugin/scripts/adapters/`.
- The state machine table in [`spec.md`](spec.md) §3.2 is data-driven; adding a stage in v0.4.0 means adding rows to that table, not refactoring callers.
- The dashboard server actions are thin: each is a one-function wrapper around an MCP tool call. Cloud-hosting v0.4.0 can move these into a serverless API surface without changing the React layer.
