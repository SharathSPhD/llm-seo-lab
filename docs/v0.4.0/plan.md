# llm-seo-lab v0.4.0 — Implementation Plan (in-repo canonical)

**Date:** 2026-04-26 · **Phase:** v0.4.0 R8.1 · **Status:** plan canonicalised · **Anchors:** [`prd.md`](prd.md), [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), `~/.cursor/plans/skip_supabase,_cloudflare_d1,_github_oauth_f8f584d9.plan.md` (Cursor-side master plan, NOT to be edited).

This is the in-repo mirror of the master plan that lives outside the repo at `~/.cursor/plans/skip_supabase,_cloudflare_d1,_github_oauth_f8f584d9.plan.md`. It is reproduced here in full so the repo is self-contained for anyone reading the v0.4.0 documentation; the master plan in `~/.cursor/plans/` remains the canonical source for Cursor's todo machinery and is not edited by R8.1-R8.7.

---

## Locked decisions (verbatim)

- **Skip Supabase / Vercel entirely.** No parallel mode. v0.3.0 git tag preserves the historical Supabase reference for anyone who needs it.
- **Cloudflare Pages + D1 (SQLite) Functions** for the hosted dashboard read/write backend.
- **GitHub OAuth** (via `@octokit/oauth-app` + `jose` JWT) for auth, replacing Supabase magic-link.
- **JSONL is canonical, SQLite is the cache, D1 is the hosted mirror.** `data/use-cases/<id>/state.jsonl` stays as the source of truth and is re-derivable on any clone.
- **Local Claude Code CLI continues to drive the inventive layer.** The hosted dashboard cannot speak to Claude; it can only enqueue intents into a `pending_actions` table that the local plugin's new `/pull:sync` command picks up.
- **Same monorepo, existing plugin updated in place.** All v0.3.0 product features (8 stages, 5 MCP tools, 3 substrate adapters, 5 plugin commands, measurement form) work identically against the new drivers; we add a sixth `/pull:sync` command and two more MCP tools (`read_pending_actions`, `mark_action_executed`).
- **`AuthUser` interface preserved bit-for-bit** so existing widgets compile when the auth shim is rewritten.
- **`LLM_SEO_LAB_AUTH=local` escape hatch preserved** so users who don't want to set up Cloudflare or GitHub OAuth can still run the dashboard against the pure local-driver path.
- **Plugin & Cursor manifests bump to v0.4.0** ([`plugin/.claude-plugin/plugin.json`](../../plugin/.claude-plugin/plugin.json), [`plugin/.cursor-plugin/plugin.json`](../../plugin/.cursor-plugin/plugin.json)).
- **Existing v0.3.0 frozen artifacts stay frozen.** No edits to `docs/v0.3.0/*`, `docs/ralph-runs/v0.3.0/R1.md..R7.md`, or the v0.3.0 entries in [`CHANGELOG.md`](../../CHANGELOG.md). v0.4.0 lands as additive doc + ralph-run sections, plus *replacement* code (Supabase code is deleted, not frozen).

## R-phase chunking

| Phase | Theme | Closes with |
|---|---|---|
| R8.1 | Document-first reorientation (PRD, spec, architecture, plan, migration; CHANGELOG 0.4.0 stub) | [`docs/ralph-runs/v0.4.0/R8.1.md`](../ralph-runs/v0.4.0/R8.1.md) |
| R8.2 | `packages/state` workspace, `StateDriver` interface, `JsonlSqliteDriver`, `D1HttpDriver`, SQLite migration, JSONL import/export scripts, full driver tests | [`docs/ralph-runs/v0.4.0/R8.2.md`](../ralph-runs/v0.4.0/R8.2.md) |
| R8.3 | Delete Supabase code; refactor MCP tools and `apps/web` server actions to use `StateDriver` | [`docs/ralph-runs/v0.4.0/R8.3.md`](../ralph-runs/v0.4.0/R8.3.md) |
| R8.4 | GitHub OAuth + JWT session; rewrite `/login`, `/auth/*`; preserve local-dev shim | [`docs/ralph-runs/v0.4.0/R8.4.md`](../ralph-runs/v0.4.0/R8.4.md) |
| R8.5 | Cloudflare Pages adapter, `wrangler.toml`, `cf:build`, `/api/sync` Pages Function | [`docs/ralph-runs/v0.4.0/R8.5.md`](../ralph-runs/v0.4.0/R8.5.md) |
| R8.6 | `pending_actions` table + intent queue; `/pull:sync` command; `read_pending_actions` + `mark_action_executed` MCP tools | [`docs/ralph-runs/v0.4.0/R8.6.md`](../ralph-runs/v0.4.0/R8.6.md) |
| R8.7 | End-to-end verification on real GitHub OAuth + Cloudflare Pages preview, all tests green, project-overview.html + README + CHANGELOG updates | [`docs/ralph-runs/v0.4.0/R8.7.md`](../ralph-runs/v0.4.0/R8.7.md), [`docs/ralph-runs/v0.4.0/R8.md`](../ralph-runs/v0.4.0/R8.md) |

## Surface delta (after v0.4.0)

| Surface | What changes | What stays |
|---|---|---|
| [`packages/state/`](../../packages/state/) (NEW) | `StateDriver` interface, `JsonlSqliteDriver`, `D1HttpDriver`, ownership guards, types | n/a |
| [`infra/d1/`](../../infra/d1/) (NEW) | `migrations/0001_init.sql` SQLite-flavored schema | n/a |
| [`infra/supabase/`](../../infra/supabase/) | DELETED | n/a |
| [`apps/web/lib/supabase/`](../../apps/web/lib/supabase/) | DELETED | n/a |
| [`apps/web/app/auth/callback/`](../../apps/web/app/auth/callback/) | DELETED | n/a |
| [`apps/web/app/login/`](../../apps/web/app/login/) | REWRITTEN — GitHub button, no email form | route path stays |
| [`apps/web/app/auth/github/{authorize,callback}/`](../../apps/web/app/auth/github/) (NEW) | OAuth dance | n/a |
| [`apps/web/app/auth/logout/`](../../apps/web/app/auth/logout/) (NEW) | clear session | n/a |
| [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) | REWRITTEN to read JWT cookie via `apps/web/lib/auth/github.ts`; preserve `AuthUser` interface | `AuthUser` shape, local-dev shim |
| [`apps/web/lib/auth/github.ts`](../../apps/web/lib/auth/github.ts) (NEW) | JWT sign/verify, cookie helpers | n/a |
| [`apps/web/lib/actions/use-cases.ts`](../../apps/web/lib/actions/use-cases.ts) | REFACTORED to call `StateDriver` instead of Supabase | function signatures |
| [`apps/web/functions/`](../../apps/web/functions/) (NEW) | Cloudflare Pages Functions for OAuth + `/api/sync` | n/a |
| [`mcp/src/tools/v030.ts`](../../mcp/src/tools/v030.ts) | REFACTORED — every tool that called `supabase` now calls `StateDriver` | tool input/output shapes |
| [`mcp/src/tools/v040.ts`](../../mcp/src/tools/v040.ts) (NEW) | `read_pending_actions`, `mark_action_executed` | n/a |
| [`plugin/commands/pull-sync.md`](../../plugin/commands/pull-sync.md) (NEW) | `/pull:sync` reads pending actions and dispatches | n/a |
| [`scripts/{export-jsonl,import-jsonl,sync-d1,import-d1}.mjs`](../../scripts/) (NEW) | JSONL ↔ SQLite ↔ D1 sync utilities | n/a |
| `wrangler.toml` (NEW, repo root) | D1 binding, env vars | n/a |
| `data/use-cases/` | unchanged content | identity |
| `data/sites/` | unchanged | v0.2.0 surface |
| `benchmarks/` | unchanged | archived |
| [`plugin/.claude-plugin/plugin.json`](../../plugin/.claude-plugin/plugin.json), [`plugin/.cursor-plugin/plugin.json`](../../plugin/.cursor-plugin/plugin.json) | bump to 0.4.0; add `/pull:sync` command | shape |

## Files to create

- `docs/v0.4.0/{prd,spec,architecture,plan,migration}.md` (this directory; created in R8.1)
- `docs/ralph-runs/v0.4.0/R8.1.md` … `R8.7.md`, plus a closing `R8.md` summarising the sweep
- `packages/state/{package.json,tsconfig.json,src/index.ts,src/driver.ts,src/types.ts,src/errors.ts,src/drivers/jsonl-sqlite.ts,src/drivers/d1-http.ts,src/drivers/jsonl-sqlite.test.ts,src/drivers/d1-http.test.ts}` (R8.2)
- `infra/d1/migrations/0001_init.sql` (R8.2)
- `scripts/{export-jsonl,import-jsonl,sync-d1,import-d1}.mjs` (R8.2)
- `apps/web/lib/auth/github.ts`, `apps/web/lib/auth/github.test.ts` (R8.4)
- `apps/web/app/auth/github/authorize/route.ts`, `apps/web/app/auth/github/callback/route.ts`, `apps/web/app/auth/logout/route.ts` (R8.4)
- `apps/web/functions/api/sync.ts`, `apps/web/functions/api/sync.test.ts` (R8.5)
- `apps/web/functions/api/pending-actions/{enqueue,read,mark-executed}.ts` (R8.6)
- `wrangler.toml` (R8.5)
- `plugin/commands/pull-sync.md` (R8.6)
- `mcp/src/tools/v040.ts`, `mcp/tests/v0.4.0.test.ts` (R8.6)

## Files to modify

- [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) — rewrite to delegate to `apps/web/lib/auth/github.ts`; preserve `AuthUser` interface; preserve local-dev shim
- [`apps/web/lib/actions/use-cases.ts`](../../apps/web/lib/actions/use-cases.ts), `.test.ts` — refactor to use `StateDriver`; tests use a fake `StateDriver` instead of a fake Supabase client
- [`apps/web/lib/substrate.ts`](../../apps/web/lib/substrate.ts) — unchanged; still detects substrate from URL
- [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx) — landing routes to `/dashboard` when signed in via GitHub, else to `/login`
- [`apps/web/components/nav.tsx`](../../apps/web/components/nav.tsx) — show GitHub login + logout link instead of Supabase email
- [`apps/web/app/login/page.tsx`](../../apps/web/app/login/page.tsx) — replace magic-link form with "Sign in with GitHub" button
- [`apps/web/app/login/actions.ts`](../../apps/web/app/login/actions.ts) — DELETE; or replace with no-op + redirect to `/auth/github/authorize`
- [`apps/web/app/use-cases/[id]/page.tsx`](../../apps/web/app/use-cases/[id]/page.tsx), `actions.ts` — change "trigger" buttons in hosted mode to enqueue pending_actions instead of calling MCP directly; local mode keeps direct calls
- [`apps/web/app/use-cases/new/page.tsx`](../../apps/web/app/use-cases/new/page.tsx), `actions.ts` — switch to `StateDriver`
- [`apps/web/app/use-cases/[id]/measurements/new/page.tsx`](../../apps/web/app/use-cases/[id]/measurements/new/page.tsx), `actions.ts` — switch to `StateDriver`
- [`apps/web/app/dashboard/page.tsx`](../../apps/web/app/dashboard/page.tsx) — switch to `StateDriver`
- [`apps/web/package.json`](../../apps/web/package.json) — drop `@supabase/*`; add `@octokit/oauth-app`, `octokit`, `jose`, `@cloudflare/next-on-pages`, `better-sqlite3` (devDep), `@llm-seo-lab/state`; add `cf:build` script
- [`mcp/src/tools/v030.ts`](../../mcp/src/tools/v030.ts) — every Supabase call replaced by a `StateDriver` call; tools accept `StateDriver` injectable for tests
- [`mcp/package.json`](../../mcp/package.json) — drop `@supabase/supabase-js`, add `@llm-seo-lab/state`, add `better-sqlite3`
- [`package.json`](../../package.json) (root) — bump `version` to `0.4.0`; add `packages/state` to `workspaces` (already covered by `packages/*`); top-level `import-jsonl`, `export-jsonl`, `sync-d1`, `import-d1` scripts
- [`plugin/.claude-plugin/plugin.json`](../../plugin/.claude-plugin/plugin.json), [`plugin/.cursor-plugin/plugin.json`](../../plugin/.cursor-plugin/plugin.json) — bump to 0.4.0; add `/pull:sync`
- [`plugin/package.json`](../../plugin/package.json) — bump to 0.4.0
- [`plugin/tests/manifest.test.ts`](../../plugin/tests/manifest.test.ts) — assert manifests are at 0.4.0; expect 13 commands (12 + `/pull:sync`)
- [`scripts/aeo-live-run.mjs`](../../scripts/aeo-live-run.mjs) — `--use-case` mode points at `StateDriver` instead of Supabase
- [`README.md`](../../README.md), [`CHANGELOG.md`](../../CHANGELOG.md) — additive v0.4.0 entries
- [`scripts/install.sh`](../../scripts/install.sh) — drop Supabase mentions, add Cloudflare Wrangler + GitHub OAuth setup notes
- [`project-overview.html`](../../project-overview.html) — additive v0.4.0 nav group + sections at the very end of R8.7

## Files to delete

- [`apps/web/lib/supabase/`](../../apps/web/lib/supabase/) (`client.ts`, `server.ts`, `env.ts`, `types.ts`, `server.test.ts`)
- [`apps/web/app/auth/callback/route.ts`](../../apps/web/app/auth/callback/route.ts)
- [`infra/supabase/`](../../infra/supabase/) (the entire `migrations/` and `tests/` directories)

## Files NOT to touch

- [`docs/v0.3.0/*`](../v0.3.0/) — frozen as the historical record
- v0.3.0 ralph reports `docs/ralph-runs/v0.3.0/R1.md..R7.md`
- v0.3.0 entries in [`CHANGELOG.md`](../../CHANGELOG.md)
- v0.2.0 ralph reports `docs/ralph-runs/R1..R7.md`
- v0.2.0 use-case reports `docs/use-cases/P1..P5*.md`, `docs/use-cases/P3-live-run-2026-04-25/`
- The Cursor-side plan file `~/.cursor/plans/skip_supabase,_cloudflare_d1,_github_oauth_f8f584d9.plan.md`

## Out of scope for v0.4.0

- Re-introducing Supabase or any equivalent managed Postgres
- Adding new substrates (WordPress, Notion, Ghost, etc.) — still v0.5+
- Auto-publishing to Substack or YouTube
- A Cursor marketplace listing for the v0.4.0 plugin (still alpha)
- Multi-tenancy in the agency sense (team views, shared use cases, billing)
- Self-hosted SQLite for the hosted dashboard (the local Next.js path covers that case)

## Verification gates (before declaring v0.4.0 GREEN in R8.7)

1. All v0.2.0 tests still pass.
2. All v0.3.0 tests still pass against the new `StateDriver` injectable (the existing 236+ tests).
3. New `packages/state` driver tests pass for both `JsonlSqliteDriver` and `D1HttpDriver`.
4. New GitHub OAuth tests pass.
5. New `/api/sync` Pages Function test passes.
6. New `read_pending_actions` + `mark_action_executed` MCP tests pass.
7. `npm run dev` (local-only mode): create a use case, run `/pull:recommend → /pull:apply → /pull:analyze` from the plugin, confirm rows appear in **all of** local SQLite, `data/use-cases/<id>/state.jsonl`. (D1 path optional in this gate.)
8. `wrangler pages dev` (local Pages Functions emulation): hosted dashboard renders state from D1, "Recommend" button writes a `pending_actions` row, `/pull:sync` picks it up, status flips to `executed`.
9. Real Cloudflare Pages preview deployment: GitHub OAuth sign-in works end-to-end against a real GitHub OAuth App; the U2 Substack seed use case renders end-to-end.
10. v0.2.0 archive routes still load with no auth regressions (cf. existing local-dev shim).
11. `/aeo:loop` still runs end-to-end against `data/sites/sharathsphd-githubio` (regression).
12. [`README.md`](../../README.md) quickstart works on a clean clone.
13. [`project-overview.html`](../../project-overview.html) v0.4.0 section loads (verified via `python3 -m http.server`); all new doc panels resolve.
