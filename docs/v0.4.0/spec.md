# llm-seo-lab v0.4.0 — Design Spec

**Date:** 2026-04-26 · **Phase:** v0.4.0 R8.1 · **Status:** spec freeze candidate (pre-implementation) · **Anchors:** [`prd.md`](prd.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), [`plan.md`](plan.md), [`../v0.3.0/spec.md`](../v0.3.0/spec.md) (frozen for reference)

This spec describes the v0.4.0 design of `llm-seo-lab` — the same `/pull:*` citation-pull workflow shipped in v0.3.0, replatformed onto Cloudflare Pages + D1 + GitHub OAuth, with Supabase removed entirely. The product surface (substrate model, adapter contract, state machine, MCP tool list) is **identical to v0.3.0 spec.md §1, §2, §3, and §5**. This document does **not** restate those sections; it describes what is new or different.

For anything not enumerated below, [`../v0.3.0/spec.md`](../v0.3.0/spec.md) remains the authoritative description of the surface.

---

## 1. What is unchanged from v0.3.0

The following sections of [`../v0.3.0/spec.md`](../v0.3.0/spec.md) carry over verbatim:

- §1 Substrate model (`web`, `substack`, `youtube`) and detection rules.
- §2 Substrate adapter contract (`Adapter` interface, three adapter implementations, `recommend / applyArtifact` shape).
- §3 State machine (8 stages, transition table, iteration counter semantics).
- §5 MCP tool surface (5 new tools, 2 deprecation envelopes for `track_citations` and `read_citation_trend`). Tool **inputs and outputs** are unchanged. The internal implementations are refactored to call `StateDriver` instead of Supabase.
- §7 Plugin command surface — except a sixth command `/pull:sync` is added in R8.6 (see §6 below).
- §8 Frontend route surface — except `/login` and `/auth/*` routes are rewritten (§5 below).
- §11 Dependencies added — `@supabase/*` removed, replaced (§7 below).

## 2. The `StateDriver` abstraction (NEW)

[`packages/state/`](../../packages/state/) is a new workspace package that owns persistence. Both MCP and the Next.js dashboard call it; neither talks to a database directly.

```ts
// packages/state/src/driver.ts
import type {
  AnalysisRow,
  ApplicationRow,
  MeasurementRow,
  RecommendationRow,
  Stage,
  UseCaseEventRow,
  UseCaseRow,
  UseCaseStateBundle,
} from "@llm-seo-lab/shared";

export interface StateDriver {
  // ----- read -----
  listUseCases(user_id: string): Promise<UseCaseRow[]>;
  getUseCase(use_case_id: string): Promise<UseCaseRow | null>;
  getUseCaseBundle(use_case_id: string): Promise<UseCaseStateBundle>;
  readPendingActions(opts: { use_case_id?: string; user_id: string }): Promise<PendingActionRow[]>;

  // ----- write (use cases) -----
  createUseCase(input: CreateUseCaseInput): Promise<UseCaseRow>;
  updateUseCaseStage(opts: {
    use_case_id: string;
    user_id: string;
    from_stage: Stage;
    to_stage: Stage;
    iteration: number;
    payload?: Record<string, unknown>;
  }): Promise<UseCaseEventRow>;

  // ----- write (children) -----
  insertRecommendations(rows: Omit<RecommendationRow, "id" | "created_at">[]): Promise<RecommendationRow[]>;
  insertApplication(row: Omit<ApplicationRow, "id" | "applied_at">): Promise<ApplicationRow>;
  insertMeasurement(row: Omit<MeasurementRow, "id" | "observed_at">): Promise<MeasurementRow>;
  insertAnalysis(row: Omit<AnalysisRow, "id" | "created_at">): Promise<AnalysisRow>;

  // ----- write (intent queue) -----
  enqueuePendingAction(row: Omit<PendingActionRow, "id" | "requested_at" | "status" | "executed_at" | "result">): Promise<PendingActionRow>;
  markActionExecuted(opts: { action_id: string; result: Record<string, unknown> }): Promise<PendingActionRow>;
}

export interface PendingActionRow {
  id: string;
  use_case_id: string;
  requested_stage: Stage;          // the stage the action would transition the UC to
  requested_by: string;            // user_id
  requested_at: string;            // ISO timestamp
  status: "pending" | "executed" | "failed";
  executed_at: string | null;
  result: Record<string, unknown> | null;
}

export interface CreateUseCaseInput {
  user_id: string;
  url: string;
  substrate: "web" | "substack" | "youtube";
  title: string;
  topic: string;
  target_audience: string | null;
  notes: string | null;
}
```

Every driver method is responsible for enforcing the **use-case ownership invariant** (the v0.3.0 `assert_user_owns_use_case` trigger, lifted into the driver layer): no write to `recommendations / applications / measurements / analyses / use_case_events / pending_actions` succeeds unless `row.user_id === use_cases.user_id` for the parent `use_case_id`. The drivers reject violating writes with a thrown `UseCaseOwnershipError`.

## 3. `JsonlSqliteDriver` (NEW)

Lives at [`packages/state/src/drivers/jsonl-sqlite.ts`](../../packages/state/src/drivers/jsonl-sqlite.ts). Behaviour:

- Backed by `better-sqlite3` against a SQLite database file at `data/state/llm-seo-lab.db` (gitignored). The database is created on first call and the schema applied from `infra/d1/migrations/0001_init.sql`.
- Every write is mirrored as a JSONL append to `data/use-cases/<use_case_id>/state.jsonl` so the JSONL stays in lockstep with SQLite. The JSONL line shape is the canonical `UseCaseEventRow` for stage transitions, and per-table `{ "kind": "recommendation" | "application" | "measurement" | "analysis" | "pending_action", … }` envelopes for child rows.
- Reads always go through SQLite. JSONL is write-mirror only; we never replay JSONL on read.
- The v0.3.0 `data/use-cases/<id>/state.jsonl` files are imported into SQLite on first call to any read method via [`scripts/import-jsonl.mjs`](../../scripts/import-jsonl.mjs) (or explicit `npm run import-jsonl`). The driver detects an empty database and runs the import automatically when `LLM_SEO_LAB_AUTOIMPORT=1`.

## 4. `D1HttpDriver` (NEW)

Lives at [`packages/state/src/drivers/d1-http.ts`](../../packages/state/src/drivers/d1-http.ts). Behaviour:

- Talks to Cloudflare D1 through the **Pages Functions binding** (`env.LLM_SEO_LAB_DB.prepare(...).bind(...).run()` etc.). When invoked from Next.js Server Actions running inside `next-on-pages`, the D1 binding is read from the request env.
- For local development against D1, the driver also accepts an HTTP transport pointing at `wrangler pages dev`'s local D1 emulation. The HTTP transport is documented in `wrangler.toml` and toggled by `LLM_SEO_LAB_D1_REMOTE=1`.
- All writes are wrapped in a transaction; on driver-side ownership-guard failure the driver does NOT issue any SQL, so a half-applied write never reaches D1.
- D1 has no triggers in v0.4.0. The ownership check runs in the driver before any `INSERT/UPDATE`.

## 5. Auth surface (REPLACED)

| Old (v0.3.0) | New (v0.4.0) |
|---|---|
| `apps/web/app/login/page.tsx` magic-link form | `apps/web/app/login/page.tsx` "Sign in with GitHub" button (or local-dev banner) |
| `apps/web/app/login/actions.ts` Supabase magic-link sender | Removed |
| `apps/web/app/auth/callback/route.ts` Supabase PKCE handler | Removed |
| n/a | `apps/web/app/auth/github/authorize/route.ts` (Pages Function) — redirects to GitHub OAuth, sets CSRF state cookie |
| n/a | `apps/web/app/auth/github/callback/route.ts` (Pages Function) — exchanges `code`, fetches user, signs JWT, sets session cookie |
| n/a | `apps/web/app/auth/logout/route.ts` (Pages Function) — clears session cookie |
| `apps/web/lib/auth.ts` (Supabase server-side getUser) | Rewritten — calls `apps/web/lib/auth/github.ts` |
| n/a | `apps/web/lib/auth/github.ts` — `getCurrentUserAsync(env)` reads cookie, verifies JWT (HS256 via `jose`), returns `AuthUser`; `requireUser()` redirects to `/auth/github/authorize` if missing |

The `AuthUser` interface is preserved bit-for-bit; the `source` discriminator changes from `"local" | "supabase"` to `"local" | "github"`.

```ts
export interface AuthUser {
  id: string;            // GitHub numeric id (or "local-dev" in local mode)
  email: string;
  display_name: string;
  source: "local" | "github";
}
```

The local-dev shim (`LLM_SEO_LAB_AUTH=local`) continues to short-circuit `getCurrentUserAsync()` with a synthetic user.

## 6. New plugin command: `/pull:sync` (NEW)

[`plugin/commands/pull-sync.md`](../../plugin/commands/pull-sync.md). Execution shape:

1. Read `pending_actions` rows for the signed-in GitHub user (or for all use cases in local-dev mode), `status='pending'`, ordered by `requested_at` ascending.
2. For each row, dispatch to the appropriate existing flow based on `requested_stage`:
   - `RECOMMENDED` → run `/pull:recommend` (calls `pull_recommend` MCP tool).
   - `APPLIED` → run `/pull:apply` (calls `pull_apply_artifact` MCP tool).
   - `ANALYZED` → run `/pull:analyze` (calls `pull_analyze` MCP tool).
   - other stages (`MEASURING`, `MEASURED`, `REPUBLISHED`, `ABANDONED`, `DRAFT`) → run `/pull:state` to record the transition without invoking Claude CLI.
3. On success: call `mark_action_executed(action_id, result)` MCP tool, which updates D1 (and the local JSONL) with `status='executed'`.
4. On failure: write `status='failed'` and surface the error to the user.

The command is read-only on D1 except for the final `mark_action_executed` write. It does not enqueue new actions.

## 7. New MCP tools

[`mcp/src/tools/v030.ts`](../../mcp/src/tools/v030.ts) gains two more tools (totalling 7 v0.3.0/v0.4.0 tools):

| # | Tool | Inputs | Output |
|---|---|---|---|
| 22 | `read_pending_actions` | `{ use_case_id?, user_id }` | Array of `PendingActionRow` |
| 23 | `mark_action_executed` | `{ action_id, result }` | Updated `PendingActionRow` |

Both go through `StateDriver`, just like the v0.3.0-original five.

## 8. SQLite schema (D1 + local SQLite, identical)

[`infra/d1/migrations/0001_init.sql`](../../infra/d1/migrations/0001_init.sql) is the SQLite-flavored equivalent of the v0.3.0 Supabase migration. Differences:

| v0.3.0 Postgres | v0.4.0 SQLite |
|---|---|
| `gen_random_uuid()` | `lower(hex(randomblob(16)))` (driver-side helper inserts a generated UUID) |
| `timestamptz default now()` | `text default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` |
| `jsonb` | `text` (drivers serialize/deserialize JSON) |
| `text[]` | `text` storing JSON array |
| Postgres enums (`use_case_stage`, `substrate`) | `text` with `check` constraint |
| RLS policies + `assert_user_owns_use_case` trigger | App-layer guards in `StateDriver` |

The SQLite schema preserves all of: `use_cases`, `use_case_events`, `recommendations`, `applications`, `measurements`, `analyses`, plus the new `pending_actions` table.

```sql
create table if not exists pending_actions (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  requested_stage text not null check (requested_stage in (
    'DRAFT','RECOMMENDED','APPLIED','REPUBLISHED',
    'MEASURING','MEASURED','ANALYZED','ABANDONED'
  )),
  requested_by text not null,
  requested_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status text not null default 'pending' check (status in ('pending','executed','failed')),
  executed_at text,
  result text
);

create index if not exists pending_actions_user_status_idx on pending_actions (requested_by, status);
create index if not exists pending_actions_uc_idx on pending_actions (use_case_id);
```

## 9. Configuration

Three new env vars (documented in [`README.md`](../../README.md) and [`scripts/install.sh`](../../scripts/install.sh) during R8.7):

- `GITHUB_OAUTH_CLIENT_ID` — public client id of the registered GitHub OAuth App.
- `GITHUB_OAUTH_CLIENT_SECRET` — secret of the registered GitHub OAuth App; server-only.
- `SESSION_JWT_SECRET` — HS256 JWT signing secret; server-only.
- `LLM_SEO_LAB_BASE_URL` — base URL of the deployed dashboard (used as the OAuth redirect target). Example: `https://llm-seo-lab.pages.dev` or `http://localhost:3030`.
- `LLM_SEO_LAB_DB` — Cloudflare D1 binding name. Set in `wrangler.toml`; not a process env var in production.

Removed: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Preserved: `LLM_SEO_LAB_AUTH=local` (escape hatch), `LLM_SEO_LAB_GIT_MIRROR=1`, `MCP_HTTP_URL`.

## 10. Dependencies added in v0.4.0

`apps/web/package.json` gains:

- `@octokit/oauth-app` — the GitHub OAuth dance.
- `octokit` — peer dep of the above and used by the user-info fetch.
- `jose` — HS256 JWT sign/verify (Edge-runtime compatible, unlike `jsonwebtoken`).
- `@cloudflare/next-on-pages` — Cloudflare Pages adapter for Next.js 15.
- `better-sqlite3` (devDependency) — local-dev driver.

Removed: `@supabase/supabase-js`, `@supabase/ssr`.

`mcp/package.json` gains:

- `@llm-seo-lab/state` (workspace) — the new `StateDriver` package.
- `better-sqlite3` — local SQLite driver.

Removed: `@supabase/supabase-js`.

A new workspace `packages/state/` is added to the root `package.json` `workspaces` array.

## 11. Tests added in v0.4.0

- [`packages/state/src/drivers/jsonl-sqlite.test.ts`](../../packages/state/src/drivers/jsonl-sqlite.test.ts) — driver round-trip, ownership-guard rejection, JSONL mirror correctness.
- [`packages/state/src/drivers/d1-http.test.ts`](../../packages/state/src/drivers/d1-http.test.ts) — driver against a fake D1 prepared-statement runtime; covers happy path + ownership guard.
- [`apps/web/lib/auth/github.test.ts`](../../apps/web/lib/auth/github.test.ts) — JWT round-trip, cookie parsing, missing-cookie redirect.
- [`apps/web/functions/auth/github/callback.test.ts`](../../apps/web/functions/auth/github/callback.test.ts) — OAuth callback exchanges `code` for token via fake `@octokit/oauth-app`.
- [`apps/web/functions/api/sync.test.ts`](../../apps/web/functions/api/sync.test.ts) — `/api/sync` accepts a JSONL bundle, applies it to a fake D1, rejects if JWT signature is wrong.
- [`mcp/tests/v0.4.0.test.ts`](../../mcp/tests/v0.4.0.test.ts) — `read_pending_actions`, `mark_action_executed` cross-process invocation; existing v0.3.0 tools work against the new `StateDriver` injectable.

The v0.3.0 `apps/web/lib/actions/use-cases.test.ts` is updated to inject a fake `StateDriver` instead of a fake Supabase client; counts stay equal or grow.

All v0.2.0 tests continue to run in `npm test`.
