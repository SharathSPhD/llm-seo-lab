# llm-seo-lab v0.4.0 — Migration guide

**Date:** 2026-04-26 · **Phase:** v0.4.0 R8.1 · **Status:** migration plan freeze candidate · **Anchors:** [`prd.md`](prd.md), [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`plan.md`](plan.md)

This document tells an operator who is currently running v0.3.0 (or who just cloned the repo at the v0.4.0 tag) how to get from "I have a Supabase project + a Vercel deployment" (or "I have nothing") to "I have a working v0.4.0 setup". It is the public-facing companion of the internal `R8.7` verification gate.

---

## 1. Breaking changes (executive summary)

| Surface | v0.3.0 | v0.4.0 |
|---|---|---|
| Auth | Supabase magic-link email | GitHub OAuth (`@octokit/oauth-app` + `jose` JWT) |
| Persistence | Supabase Postgres + RLS | SQLite (local `better-sqlite3`) + Cloudflare D1 (hosted) + JSONL (canonical, git-tracked) |
| Hosting | Vercel | Cloudflare Pages (free tier) |
| Env vars (auth) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_JWT_SECRET`, `LLM_SEO_LAB_BASE_URL` |
| Env vars (db) | (none — `SUPABASE_URL` covered it) | D1 binding `LLM_SEO_LAB_DB` (set in `wrangler.toml`, not a process env var) |
| Trigger queue | n/a (dashboard called MCP directly) | `pending_actions` table, intent queue between hosted dashboard and local plugin |
| Plugin commands | 12 | 13 (`/pull:sync` added) |
| MCP tools | 21 (5 v0.3.0 + 14 v0.2.0 + 2 deprecated) | 23 (v0.4.0 adds `read_pending_actions`, `mark_action_executed`) |

Anyone who needs the Supabase reference can `git checkout v0.3.0`. The v0.3.0 git tag is preserved and never edited.

## 2. One-time setup checklist (new clone)

You do this **once**. After this, day-to-day work uses `npm run dev` or `wrangler pages dev` (see §5) and `/pull:*` plugin commands.

### 2.1 Prerequisites

- Node 20+ (we test on 20.11 and 22.x).
- `npm` 10+.
- `gh` (GitHub CLI), authenticated (`gh auth status` returns OK).
- `git` 2.40+.
- `claude` CLI (subscription-based) installed and signed in. Verify with `claude --print 'hello'`.
- (For hosted mode) A Cloudflare account on the free tier — sign up at <https://dash.cloudflare.com>.
- (For hosted mode) `npm install -g wrangler` and `wrangler login`.
- (Optional) `uv` 0.4+ for the Pratyakṣa Buddhi gate.

### 2.2 Clone and install

```bash
git clone https://github.com/SharathSPhD/llm-seo-lab.git
cd llm-seo-lab
git submodule update --init --recursive
npm install
```

### 2.3 Build the local SQLite cache from the canonical JSONL

```bash
npm run import-jsonl
```

This populates `data/state/llm-seo-lab.db` (gitignored) from the JSONL files committed to `data/use-cases/<id>/state.jsonl`. The three v0.3.0 seed use cases (`u1-technektar-dev`, `u2-technektar-substack-context-window`, `u3-youtube-fM2hpqPx8zg`) are imported at this step.

### 2.4 Choose your auth path

- **Local-dev shim only.** Set `LLM_SEO_LAB_AUTH=local` in `apps/web/.env.local`. Skip §2.5 and §2.6 entirely. The dashboard runs as a single-user `local-dev` identity.
- **GitHub OAuth (recommended for hosted use).** Continue with §2.5.

### 2.5 Register a GitHub OAuth App (one-time, hosted mode only)

1. Go to <https://github.com/settings/developers> → "OAuth Apps" → "New OAuth App".
2. **Application name:** `llm-seo-lab` (or anything you want).
3. **Homepage URL:** `https://<your-pages-subdomain>.pages.dev` (placeholder; update after first deploy if needed).
4. **Authorization callback URL:** `https://<your-pages-subdomain>.pages.dev/auth/github/callback`.
5. Click "Register application".
6. Copy the **Client ID**.
7. Click "Generate a new client secret"; copy the secret immediately (GitHub will not show it again).
8. Add a **second** OAuth App for local development with callback `http://localhost:3030/auth/github/callback` and a different secret.

### 2.6 Create a Cloudflare D1 database (one-time, hosted mode only)

```bash
wrangler login
wrangler d1 create llm-seo-lab
```

The CLI prints a `database_id`. Add it to `wrangler.toml` at the repo root (R8.5 generates this file as part of the v0.4.0 sweep; for now you would manually paste the binding):

```toml
name = "llm-seo-lab"
compatibility_date = "2026-04-26"

[[d1_databases]]
binding = "LLM_SEO_LAB_DB"
database_name = "llm-seo-lab"
database_id = "<paste here>"
```

Apply the SQLite schema:

```bash
wrangler d1 execute llm-seo-lab --file infra/d1/migrations/0001_init.sql
```

Push the seed JSONL data into D1:

```bash
npm run sync-d1 -- --remote
```

(`--remote` targets the deployed D1; omit to target the local emulator that `wrangler pages dev` provides.)

### 2.7 Set up env vars

Create `apps/web/.env.local` for local development:

```
LLM_SEO_LAB_BASE_URL=http://localhost:3030
GITHUB_OAUTH_CLIENT_ID=<local OAuth App client id>
GITHUB_OAUTH_CLIENT_SECRET=<local OAuth App client secret>
SESSION_JWT_SECRET=<openssl rand -hex 32>
LLM_SEO_LAB_AUTH=github
LLM_SEO_LAB_GIT_MIRROR=1
```

Set the same keys in Cloudflare Pages (dashboard → Pages → your project → Settings → Environment variables), with the **deployed** OAuth App's client id/secret and `LLM_SEO_LAB_BASE_URL=https://<your-pages-subdomain>.pages.dev`.

## 3. Migrating from a v0.3.0 install (Supabase → v0.4.0)

If you previously ran v0.3.0 with a Supabase project, follow these steps **before** wiping any state:

### 3.1 Export your Supabase data

The v0.3.0 schema lives at `infra/supabase/migrations/0001_init.sql`. Export every table you care about as JSONL:

```bash
# Pseudocode; the exact incantation depends on whether you use the Supabase CLI
# or `psql`. The repo does NOT ship an automated exporter — you do this once,
# manually, before deleting your Supabase project.
supabase db dump --data-only --table use_cases > backup/use_cases.json
supabase db dump --data-only --table use_case_events > backup/use_case_events.json
# … repeat for recommendations, applications, measurements, analyses
```

### 3.2 Reshape into the JSONL canonical format

For each use case, a single `data/use-cases/<id>/state.jsonl` file should be produced, where each line is a `UseCaseEventRow` JSON object (stage transition) or a child-table envelope (`{ "kind": "recommendation" | "application" | "measurement" | "analysis", … }`). The exact shape is described in [`spec.md`](spec.md) §3.

If you are running the three v0.3.0 seed use cases unmodified, you do **not** need to do anything — they are already in the repo.

### 3.3 Import into the v0.4.0 stack

```bash
git checkout v0.4.0
npm install
npm run import-jsonl
```

This rebuilds your local SQLite cache from JSONL. To push it to D1, follow §2.6.

### 3.4 Decommission Supabase

After confirming the v0.4.0 dashboard reads everything correctly:

1. Pause the Supabase project in the Supabase dashboard.
2. Remove `SUPABASE_*` from your local `.env.local` and from any deployment env config (Vercel, etc.).
3. Optional: delete the Supabase project after you have kept the JSONL backup for at least a week.

The repo no longer reads Supabase env vars. The build will succeed without them.

## 4. Migrating from a v0.3.0 Vercel deploy

The v0.3.0 plan documented Vercel as a future target; if you actually deployed there, decommission as follows:

1. In the Vercel dashboard, mark the project as "paused" or delete it.
2. Update any DNS records that point at the Vercel deployment to point at your Cloudflare Pages preview/production URL.
3. Remove any `SUPABASE_*` env vars from the Vercel project (now moot).

If you never deployed to Vercel, ignore this section.

## 5. Running v0.4.0 day-to-day

### 5.1 Pure local mode

```bash
cd apps/web
npm run dev
# in another terminal:
bash plugin/scripts/aeo-mcp.sh start
# then run /pull:* commands from Cursor or Claude Code
```

Dashboard at <http://localhost:3030>. Auth is the local-dev shim (`LLM_SEO_LAB_AUTH=local`) or real GitHub OAuth depending on `.env.local`.

### 5.2 Local Pages-Functions emulation (test the hosted path)

```bash
cd apps/web
npm run cf:build           # produces .vercel/output/static for next-on-pages
wrangler pages dev .vercel/output/static --d1 LLM_SEO_LAB_DB=llm-seo-lab
```

Dashboard at <http://localhost:8788>. Pages Functions (`/auth/github/*`, `/api/sync`, `/api/pending-actions/*`) work end-to-end against a local D1 emulator.

### 5.3 Real Cloudflare Pages deploy

Either via the Cloudflare Pages GitHub integration (recommended) or:

```bash
cd apps/web
npm run cf:build
wrangler pages deploy .vercel/output/static --project-name llm-seo-lab
```

Dashboard at `https://<your-pages-subdomain>.pages.dev`. GitHub OAuth must point at this URL.

### 5.4 Plugin loop from a hosted dashboard click

1. User opens hosted dashboard, clicks "Recommend" on a use case.
2. Server action (running in a Cloudflare Pages Function) writes a `pending_actions` row to D1, status `pending`. UI shows "queued".
3. User opens Cursor or Claude Code on a machine where the plugin is installed and the local MCP is running.
4. User runs `/pull:sync`.
5. Plugin reads pending actions from D1 (or local SQLite in pure-local mode), dispatches to `/pull:recommend`, writes results back to D1 and to the JSONL mirror, flips status to `executed`.
6. Hosted dashboard revalidates; "queued" badge becomes "executed" with the new recommendations rendered.

## 6. Free-tier limits

| Service | Free-tier limit (April 2026) | What happens when you exceed |
|---|---|---|
| Cloudflare Pages | 500 builds/month, unlimited bandwidth, 100k Functions requests/day | Builds queue; Functions return 429; falls back to static pages |
| Cloudflare D1 | 5 million row reads/day, 100k row writes/day, 5GB storage | D1 returns 429; you can upgrade to D1 paid or fall back to local-only |
| GitHub OAuth | unlimited authorization redirects (rate-limited per app at 5k/hr) | OAuth dance fails with 429; user retries |

For the lab's intended use (a single creator iterating on a handful of use cases), these limits are not a concern.

## 7. Recovery paths

| Symptom | Recovery |
|---|---|
| `data/state/llm-seo-lab.db` deleted or corrupted | `npm run import-jsonl` rebuilds from JSONL |
| D1 wiped or migrated to a new database | `wrangler d1 execute … 0001_init.sql` then `npm run sync-d1 -- --remote` |
| JSONL mirror diverged from local SQLite | `npm run export-jsonl` rewrites JSONL from SQLite (local SQLite wins) |
| GitHub OAuth client secret leaked | regenerate on github.com/settings/developers, update `apps/web/.env.local` and Pages env, redeploy |
| `SESSION_JWT_SECRET` leaked | regenerate (`openssl rand -hex 32`), update env, redeploy — all existing sessions invalidate (users sign in again) |
| Pending action stuck in `pending` because `/pull:sync` failed | re-run `/pull:sync`; on persistent failure, manually flip the row in D1 console or rerun the underlying flow with `/pull:recommend` etc. |

## 8. What you do NOT migrate

- v0.2.0 site fixtures under `data/sites/`. Same shape, no change.
- v0.2.0 ralph reports under `docs/ralph-runs/R1.md..R7.md`. Frozen.
- v0.3.0 ralph reports under `docs/ralph-runs/v0.3.0/R1.md..R7.md`. Frozen.
- The v0.2.0 / v0.3.0 sections of `project-overview.html`. R8.7 lands a v0.4.0 section additively.
- Existing Cursor / Claude Code plugin installs that point at this checkout — they will pick up the new `/pull:sync` command on the next plugin reload.

## 9. Roll-back path

If v0.4.0 turns out to be unworkable for your environment:

```bash
git checkout v0.3.0
npm install
# follow docs/v0.3.0/migration.md to re-provision a Supabase project
```

The JSONL mirror at `data/use-cases/<id>/state.jsonl` is shared between v0.3.0 and v0.4.0 (same row shapes), so your state is portable in both directions.

## 10. Open questions deliberately deferred to v0.5+

- Multi-user collaboration (shared use cases, team views).
- Self-hosted SQLite alternative for the hosted dashboard (today: Cloudflare D1 only).
- Automated OAuth App registration via the GitHub API.
- Pre-built Docker image of the local stack (today: `npm install` + `wrangler` is the path).
- Cursor marketplace listing (still alpha in v0.4.0).
