# llm-seo-lab v0.4.0 — Product Requirements Document

**Date:** 2026-04-26 · **Phase:** v0.4.0 R8.1 · **Status:** PRD candidate (pre-implementation freeze) · **Anchors:** [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), [`plan.md`](plan.md), [`../v0.3.0/prd.md`](../v0.3.0/prd.md) (frozen for reference)

This PRD reorients the v0.3.0 dashboard backend. v0.3.0 shipped a Supabase + Vercel reference implementation; v0.4.0 keeps the **`/pull:*` workflow exactly as v0.3.0 designed it** but replaces the entire persistence and hosting stack with **Cloudflare Pages + D1 (SQLite) + GitHub OAuth**. The product surface (use cases, stages, recommendations, applications, measurements, analyses, substrate adapters) is unchanged. The *infrastructure* is replatformed to honour the project-wide "no per-token API, no paid managed backends, JSONL-canonical state" constraint that has been the user's intent throughout.

---

## 1. Problem (one paragraph)

v0.3.0 implemented the citation-pull workflow against a Supabase project (auth + Postgres + RLS) deployed alongside a Vercel-hosted Next.js app. That stack ships with two cost contours we want to avoid: (a) a managed Postgres that is free at the edges but paid as soon as anyone runs more than a hobbyist workload, and (b) a Vercel hosting tier whose pricing model depends on per-invocation function compute. Both contradict the project's load-bearing constraint that the lab should be runnable end-to-end on a Claude **subscription** with no per-token / per-invocation managed dependencies. The user has also pointed out that the lab already has a JSONL state mirror under `data/use-cases/<id>/state.jsonl` that is committed to git and is therefore re-derivable on any clone — making Supabase Postgres redundant as the *source of truth*. v0.4.0 takes that observation seriously: **JSONL is canonical, SQLite is the cache, D1 is the hosted mirror, GitHub OAuth replaces magic-link, Cloudflare Pages replaces Vercel, and Supabase is removed entirely with no parallel mode kept alive**.

## 2. Goal (the IFR sentence for v0.4.0)

> A system that, when a user adds any owned content URL — git-backed page, Substack post, YouTube video, hosted CMS — produces substrate-aware citation-pull recommendations that the user applies, observes, and analyses across iterations, with **zero managed-backend cost**: state lives in JSONL files committed to the repo and a Cloudflare D1 SQLite mirror; auth is GitHub OAuth; hosting is Cloudflare Pages free tier; Claude Code CLI continues to run on the user's own machine on the user's own subscription; the local plugin and the hosted dashboard talk to one another through a shared `pending_actions` queue so the user can drive the loop from either surface without ever touching a paid SaaS.

## 3. Non-goals (v0.4.0)

- **Re-introducing Supabase or any equivalent managed Postgres.** All Supabase code, env vars, and migration SQL are removed in R8.3. The project does not maintain a parallel Supabase mode. Anyone who needs the v0.3.0 Supabase reference implementation can `git checkout v0.3.0`.
- **Rewriting the v0.3.0 product surface.** The 8-stage state machine, the 5 MCP tools, the 3 substrate adapters, the 5 plugin commands, the user-reported measurement form, the iteration counter — all unchanged. v0.4.0 is an infrastructure replatform, not a product redesign.
- **Auto-publishing to Substack / YouTube / any CMS.** Same scope as v0.3.0 — paste-ready artifacts only.
- **Self-hosting D1.** D1 is a Cloudflare-managed SQLite product on the free tier; v0.4.0 uses it as-is. We do not document a self-hosted SQLite alternative for the hosted dashboard (the local Next.js dev server already covers that case via the `JsonlSqliteDriver`).
- **Cloud-running Claude Code CLI.** The CLI continues to run **only** on the developer's local machine. The hosted dashboard never has direct access to a Claude session; it can only enqueue intents that the local plugin picks up via `/pull:sync`.
- **Multi-tenancy in the agency sense.** Each GitHub user is one isolated tenant. There are no team views, shared use cases, or cross-user audit trails. The agency v0.5+ feature set is explicitly deferred.
- **A Cursor marketplace listing for v0.4.0.** Still alpha; users install from a local path or a git tag.

## 4. Target user (v0.4.0)

**Primary persona — "GitHub-native multi-substrate creator."** A solo author, indie dev, or small-team operator who:

- Has a GitHub account (this is now the auth substrate).
- Owns at least two distinct content surfaces of different substrates (e.g. a personal site + a Substack + a YouTube channel).
- Has `claude` CLI working (subscription, no API key required).
- Can run a local Next.js dev server (or `wrangler pages dev`) and a local MCP HTTP server.
- Is willing to set up a one-time Cloudflare account + D1 database (`wrangler d1 create`) and a GitHub OAuth App (one-time, free).
- Is comfortable accepting that the system does not guarantee a citation lift; convergence requires multiple iterations.

**Secondary persona — "Local-only operator."** Someone who does not want to set up Cloudflare or GitHub OAuth at all. v0.4.0 supports this via `LLM_SEO_LAB_AUTH=local`: the dashboard runs entirely against the local SQLite + JSONL with a synthetic single-user identity, and there is no hosted mirror. This is the existing v0.2.0 / v0.3.0 local-dev shim, preserved bit-for-bit.

**Out of v0.4.0:** anyone who needs a managed Postgres, anyone who wants the dashboard to publish on their behalf, anyone who wants automated AI-engine citation tracking without manual observation, agencies managing 10+ third-party use cases.

## 5. v0.4.0 feature inventory (delta vs v0.3.0)

The product features are unchanged from v0.3.0. The infrastructure delta is:

### F.1 — GitHub OAuth in place of Supabase magic-link

- F.1.1 `/login` shows a **single "Sign in with GitHub" button** (or, in local-dev mode, the same banner v0.3.0 used).
- F.1.2 `/auth/github/authorize` redirects to `https://github.com/login/oauth/authorize` with a per-request CSRF state cookie and `scope=read:user user:email`.
- F.1.3 `/auth/github/callback` exchanges the `code` for an access token via `@octokit/oauth-app`, fetches the GitHub user, signs an HS256 JWT (via `jose`) carrying `{ sub: <github numeric id>, login, email }`, and sets it as an HttpOnly + Secure cookie on the response.
- F.1.4 `/auth/logout` clears the session cookie and redirects to `/`.
- F.1.5 `getCurrentUserAsync()` reads the cookie, verifies the JWT, returns an `AuthUser` with `source: "github"` (or `"local"` in local-dev mode).
- F.1.6 The `AuthUser` interface is preserved bit-for-bit so v0.2.0 widgets still compile.

### F.2 — JSONL-canonical, SQLite-cached, D1-mirrored state

- F.2.1 `data/use-cases/<id>/{config.json,state.jsonl}` remain the canonical state. Anyone can `git clone` the repo, run `npm run import-jsonl`, and have a fully-populated local SQLite cache with no remote dependencies.
- F.2.2 Every write goes through the `StateDriver` interface in `packages/state/`. Two implementations:
  - `JsonlSqliteDriver` — local; uses `better-sqlite3` for queries, appends to JSONL on every mutation. Default driver.
  - `D1HttpDriver` — hosted; talks to Cloudflare D1 via the Pages Functions binding (`env.LLM_SEO_LAB_DB`). Used by the hosted dashboard.
- F.2.3 `scripts/export-jsonl.mjs` rewrites `data/use-cases/<id>/state.jsonl` from the local SQLite cache. Replaces the deterministic generator from v0.3.0's `scripts/seed-use-cases.mjs`.
- F.2.4 `scripts/import-jsonl.mjs` imports JSONL into a fresh SQLite cache. Used on first boot and as a recovery path.
- F.2.5 `scripts/sync-d1.mjs` pushes the local SQLite snapshot to D1 via the Pages Functions `/api/sync` endpoint (auth: a JWT signed with the same OAuth secret).

### F.3 — Cloudflare Pages hosting

- F.3.1 The dashboard ships as a Cloudflare Pages app via the `@cloudflare/next-on-pages` adapter. Build script: `npm run cf:build` in `apps/web/`.
- F.3.2 D1 binding `LLM_SEO_LAB_DB` configured in `wrangler.toml` at the repo root.
- F.3.3 Pages Functions under `apps/web/functions/` for: `/auth/github/{authorize,callback}`, `/auth/logout`, `/api/sync`, `/api/pending-actions/{enqueue,read,mark-executed}`.
- F.3.4 Free-tier limits respected: <100k requests/day, <100k D1 row reads/day per project. Documented in [`migration.md`](migration.md) §6.
- F.3.5 `wrangler pages dev` is the canonical way to test the Pages Functions path locally; `npm run dev` continues to work for the pure local-driver path (no Pages Functions, just Next.js dev server against `JsonlSqliteDriver`).

### F.4 — Pending-actions queue

- F.4.1 New table `pending_actions(id, use_case_id, requested_stage, requested_by, requested_at, status, executed_at, result)`.
- F.4.2 Hosted dashboard "Recommend / Apply / Analyze" buttons no longer call MCP directly. Instead they `INSERT` a `pending_actions` row with `status='pending'`. The dashboard immediately revalidates and shows "queued: waiting for local /pull:sync".
- F.4.3 New plugin command `/pull:sync` (read-only on D1, read-write on local SQLite) reads pending actions for the signed-in GitHub user, dispatches each to the existing `/pull:recommend|apply|analyze` flows, writes the result back to D1 and to the local JSONL, and flips the row's `status='executed'`.
- F.4.4 Two new MCP tools: `read_pending_actions(use_case_id?)` and `mark_action_executed(action_id, result)`.
- F.4.5 Local-dev mode: `pending_actions` lives in the local SQLite mirror; `/pull:sync` becomes a single-machine queue. The behaviour is identical, just without the network hop.

### F.5 — Local-dev escape hatch (preserved)

- F.5.1 `LLM_SEO_LAB_AUTH=local` skips the GitHub OAuth dance entirely and returns a synthetic `local-dev` user identical to the v0.2.0 / v0.3.0 shim.
- F.5.2 In local mode the `D1HttpDriver` is never instantiated; everything goes through `JsonlSqliteDriver`.
- F.5.3 The `/login` page in local mode shows the same "signed in as local-dev" banner as v0.3.0 did.

## 6. What we explicitly remove

| Surface (v0.3.0) | v0.4.0 status | Reason |
|---|---|---|
| `apps/web/lib/supabase/{server,client,env,types,server.test}.ts` | Deleted | No parallel Supabase mode in v0.4.0 |
| `apps/web/app/auth/callback/route.ts` (Supabase PKCE) | Deleted | Replaced by `/auth/github/callback` |
| `apps/web/app/login/{page,actions}.tsx` (Supabase magic-link form) | Deleted, replaced with GitHub button | See F.1 |
| `infra/supabase/migrations/0001_init.sql` | Deleted | Replaced by `infra/d1/migrations/0001_init.sql` (SQLite-flavored) |
| `infra/supabase/tests/rls.test.sql` | Deleted | RLS is now enforced in the app layer (driver + server actions check `user_id`) |
| `@supabase/supabase-js`, `@supabase/ssr` deps | Removed | Replaced by `octokit`, `jose`, `@octokit/oauth-app`, `better-sqlite3`, `@cloudflare/next-on-pages` |
| `SUPABASE_*` env vars | Removed | Replaced by `GITHUB_OAUTH_*`, `SESSION_JWT_SECRET`, `LLM_SEO_LAB_BASE_URL`, `LLM_SEO_LAB_DB` (D1 binding name) |
| Postgres `assert_user_owns_use_case` trigger | Replaced by app-layer driver guard | Driver checks the use_case's owner before every child write |

## 7. Success criteria for v0.4.0 release

A v0.4.0 tag is cut only when **all** of the following hold:

1. All v0.3.0 product features (the 8 stages, the 5 MCP tools, the 3 substrate adapters, the 5 plugin commands, the measurement form) work identically against `JsonlSqliteDriver` in local-dev mode.
2. The same product features work against `D1HttpDriver` in `wrangler pages dev` mode and on a deployed Cloudflare Pages preview.
3. GitHub OAuth sign-in + sign-out work end-to-end on a real Cloudflare Pages preview deployment with a real GitHub OAuth App registered against the user's account.
4. The three v0.3.0 seed use cases (`u1-technektar-dev`, `u2-technektar-substack-context-window`, `u3-youtube-fM2hpqPx8zg`) load into both the local SQLite cache and a fresh D1 database via `npm run import-jsonl` and `npm run sync-d1`, with all stage events preserved.
5. `/pull:sync` against a hosted Cloudflare Pages preview successfully picks up a pending action, dispatches to `/pull:recommend|apply|analyze`, writes the result to D1, and flips `pending_actions.status='executed'`.
6. All v0.2.0 tests still pass; all v0.3.0 tests pass against the new drivers; new v0.4.0 driver and OAuth tests pass; total test count grows or stays the same.
7. `/aeo:loop` still runs end-to-end against `data/sites/sharathsphd-githubio` (regression).
8. README quickstart works on a clean clone end-to-end (clone → `wrangler d1 create` → register GitHub OAuth App → `npm run dev` or `wrangler pages dev`).
9. `project-overview.html` v0.4.0 nav group + sections added; the lazy-loaded panels resolve.

## 8. What v0.4.0 does NOT claim

Reproduced into [`../limitations.md`](../limitations.md) under a v0.4.0 section header during R8.7:

- **GitHub OAuth ties the user identity to a GitHub login.** Users without a GitHub account cannot use the hosted dashboard. They can still use the local-dev mode.
- **D1 is a Cloudflare product on the free tier.** Cloudflare's free-tier limits apply (<100k row reads/day, <5GB storage, etc.). A heavy user must move to D1's paid tier or fall back to the local-only `JsonlSqliteDriver`.
- **The hosted dashboard cannot trigger Claude CLI directly.** It can only enqueue intents. The user must run `/pull:sync` locally to actually advance a use case from the hosted UI.
- **There is no Postgres-style cross-row constraint enforcement.** The Supabase trigger that asserted `user_id` ownership is replaced by an app-layer guard in `JsonlSqliteDriver` and `D1HttpDriver`. A bug in either driver could in principle allow cross-user writes; we mitigate with extensive driver tests but do not have a database-level fence.
- **No multi-user collaboration.** A use case is owned by exactly one GitHub login. There are no shared use cases, no team views, no audit trails of cross-user edits.
- **Three substrates only.** Same as v0.3.0 — `web`, `substack`, `youtube`. WordPress, Notion, Ghost, etc. remain out of scope.
