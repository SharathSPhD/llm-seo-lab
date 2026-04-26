# llm-seo-lab v0.3.0 — Design Spec

**Date:** 2026-04-26 · **Phase:** v0.3.0 R1 · **Status:** spec freeze candidate (pre-implementation) · **Anchors:** [`prd.md`](prd.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), [`../triz/v0.3.0-pull-finalists.md`](../triz/v0.3.0-pull-finalists.md) (will exist post-R2)

This spec describes the v0.3.0 design of `llm-seo-lab` — the citation-pull workflow that supersedes the competitor-gap loop as the product's centre of gravity. The competitor-gap loop (v0.2.0) is preserved verbatim as one tactic the new recommender can choose; this spec does not modify any v0.2.0 surface beyond what the migration plan ([`migration.md`](migration.md)) explicitly enumerates. No code changes are made before this spec is approved.

---

## 1. Substrate model

A **substrate** is the platform that hosts the URL the user is trying to move up in AI-engine citations. v0.3.0 supports three: `web`, `substack`, `youtube`. Each substrate exposes a different set of editable knobs and a different application path.

| Substrate | Knobs | Apply path |
|---|---|---|
| `web` (git-backed) | HTML, JSON-LD, frontmatter, meta tags, headings, internal links, sitemap | PR diff (uses v0.2.0 `open_pr` machinery) |
| `web` (hosted CMS, no git) | Same knobs but no git remote detected | Paste-ready HTML/Markdown blocks + checklist |
| `substack` | Post body Markdown, subheads, lede, link blocks, post tags, post title, custom URL slug, paid/free toggle | Paste-ready Markdown + diff-report |
| `youtube` | Title, description, tags, chapter timestamps, pinned comment, end-card text, info-card text, captions/transcript edits | Copy-paste checklist mapped to YouTube Studio fields |

Substrate is detected from the URL pattern at use-case creation:

- `*.substack.com/p/*` → `substack`
- `youtube.com/watch?v=*`, `youtu.be/*`, `youtube.com/shorts/*` → `youtube`
- everything else → `web`

The user can override the auto-detection. The detection routine lives in `apps/web/lib/substrate.ts`.

## 2. Substrate adapter contract

Every adapter implements the same TypeScript interface, lives under `plugin/scripts/adapters/`, and is invoked by the MCP server (not by the dashboard directly):

```ts
export interface UseCase {
  id: string;
  user_id: string;
  url: string;
  substrate: "web" | "substack" | "youtube";
  title: string;
  topic: string;
  target_audience: string;
  current_stage: Stage;
  notes?: string;
  recommendations: Recommendation[];
  applications: Application[];
  measurements: Measurement[];
  analyses: Analysis[];
}

export interface Recommendation {
  id: string;
  use_case_id: string;
  iteration: number;
  triz_principle: string; // e.g. "atomic-snippet-density"
  applicability_score: number; // 0..1, substrate-specific
  knob: string; // e.g. "json_ld_faqpage", "pinned_comment", "lede_paragraph"
  diff_summary: string; // one-line human-readable
  payload: Record<string, unknown>; // adapter-specific
  rationale: string; // why this should pull a citation
  expected_engines: string[]; // which engines the recommender thinks this will move
  created_at: string;
}

export interface Artifact {
  recommendation_id: string;
  artifact_kind: "pr_diff" | "paste_markdown" | "paste_html" | "youtube_checklist";
  primary: string; // the headline payload (diff, markdown, checklist body)
  ancillary?: Record<string, string>; // per-knob extras the user may need
  human_steps: string[]; // ordered manual steps for the user
}

export interface Adapter {
  recommend(useCase: UseCase): Promise<Recommendation[]>;
  applyArtifact(rec: Recommendation, useCase: UseCase): Promise<Artifact>;
}
```

Each adapter holds **no Supabase or HTTP state**. State flows in via `UseCase` (loaded by MCP from Supabase before each call) and out via the return value (persisted by MCP after each call). This keeps the adapters pure and unit-testable.

### 2.1 Web adapter

- Auto-detects git-backed vs hosted by checking `gh repo view <owner>/<repo>` against any URL → repo mappings the user supplied at use-case creation.
- Recommendations are drawn from the v0.2.0 `aeo-audit` skill plus the v0.3.0 charter principles (atomic-snippet density, semantic-anchor stability, cross-engine attractor convergence).
- Apply path: PR diff if git-backed; paste-ready blocks if not. PR creation reuses [`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts) `open_pr` (line 369) but does NOT auto-open — it produces the diff and lets the user opt in.

### 2.2 Substack adapter

- Reads the post URL via a one-shot fetch (Substack public posts are openable with `curl`). No login. No Substack API.
- Recommendation knobs: `lede_rewrite` (answer-first first paragraph), `subhead_restructure` (Q-shaped subheads matching expected engine prompts), `link_block_addition` (high-authority outbound citations), `pinned_quote_callout` (Substack pull-quote that doubles as a snippet target), `tags`, `slug_optimization`.
- Apply artifact: paste-ready Markdown that reproduces the post's existing structure with the recommended changes inlined, plus a diff-report listing every change line-by-line so the user can review before pasting.

### 2.3 YouTube adapter

- Reads the video page via `yt-dlp --dump-json` if available on the user's system (preferred), or falls back to a curl + parse of the public oEmbed endpoint for title/description.
- Recommendation knobs: `title_rewrite` (Q-shaped title containing the central question), `description_structure` (timestamp index + structured answer in the first 200 chars), `chapters` (timestamp + Q-shaped label per chapter), `tags` (engine-relevant tag set), `pinned_comment` (full structured answer with citations the engine retrievers can index), `end_card_text`, `transcript_pinning` (corrected captions where transcript matters for retrieval).
- Apply artifact: a YouTube Studio checklist. Each line is `field: <value>` and includes a "where to find this in Studio" pointer. The user works through the checklist and clicks Save in Studio.

## 3. State machine

### 3.1 Stages

Allowed values for `use_cases.current_stage`:

```
DRAFT → RECOMMENDED → APPLIED → REPUBLISHED → MEASURING → MEASURED → ANALYZED
                                                                           ↓
                                                                     RECOMMENDED (next iteration)
                                                                           ↓
                                                                      ABANDONED (terminal)
```

Plus `ABANDONED` is reachable from any non-terminal stage.

### 3.2 Allowed transitions

The full transition table is enforced both in the dashboard server actions and in MCP `record_use_case_event`:

| From | To | Trigger | Side effects |
|---|---|---|---|
| `DRAFT` | `RECOMMENDED` | user clicks Recommend | `pull_recommend` MCP call; rows in `recommendations` |
| `RECOMMENDED` | `APPLIED` | user clicks Mark applied | row in `applications` capturing what artifact the user used |
| `APPLIED` | `REPUBLISHED` | user clicks Republished | event row only |
| `REPUBLISHED` | `MEASURING` | user clicks Start measuring | event row + measurement window opens |
| `MEASURING` | `MEASURED` | user clicks Mark measurement complete (after ≥1 observation) | event row only |
| `MEASURED` | `ANALYZED` | user clicks Analyze | `pull_analyze` MCP call; row in `analyses` |
| `ANALYZED` | `RECOMMENDED` | user clicks Next iteration | event row; iteration counter increments |
| any non-terminal | `ABANDONED` | user clicks Abandon | event row |

Any transition not in this table is rejected with `{ok:false, error:"illegal_transition"}`.

### 3.3 Iteration counter

`recommendations.iteration`, `applications.iteration`, `measurements.iteration`, `analyses.iteration` are all the same integer for one cycle. It increments on every `ANALYZED → RECOMMENDED` transition. This is the A/B unit.

## 4. Supabase schema

Lives at [`infra/supabase/migrations/0001_init.sql`](../../infra/supabase/migrations/0001_init.sql) (created in R3). All rows except `profiles` are RLS-protected by `user_id = auth.uid()`.

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create type use_case_stage as enum (
  'DRAFT', 'RECOMMENDED', 'APPLIED', 'REPUBLISHED',
  'MEASURING', 'MEASURED', 'ANALYZED', 'ABANDONED'
);

create type substrate as enum ('web', 'substack', 'youtube');

create table use_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  url text not null,
  substrate substrate not null,
  title text not null,
  topic text not null,
  target_audience text,
  current_stage use_case_stage not null default 'DRAFT',
  current_iteration int not null default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table use_case_events (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  from_stage use_case_stage,
  to_stage use_case_stage not null,
  iteration int not null,
  payload jsonb,
  created_at timestamptz default now()
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  triz_principle text not null,
  applicability_score numeric(4,3) not null,
  knob text not null,
  diff_summary text not null,
  payload jsonb not null,
  rationale text not null,
  expected_engines text[] not null,
  claude_run_id text,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_cases on delete cascade,
  recommendation_id uuid not null references recommendations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  artifact_kind text not null,
  artifact_summary text not null,
  applied_at timestamptz default now()
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  engine text not null,
  prompt text not null,
  observed_answer text not null,
  citation_present boolean not null,
  citation_position int,
  source_authority text,
  notes text,
  screenshot_path text,
  observed_at timestamptz default now()
);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  verdict text not null check (verdict in ('improved','stable','regressed','inconclusive','stub')),
  per_engine_delta jsonb,
  attractor_metrics jsonb,
  triz_principles_cited text[],
  next_iteration_suggestion text,
  claude_run_id text,
  created_at timestamptz default now()
);
```

RLS policy template (applied to every table except `profiles`):

```sql
alter table use_cases enable row level security;
create policy "owner read"  on use_cases for select using (user_id = auth.uid());
create policy "owner write" on use_cases for all    using (user_id = auth.uid());
```

A deny-test in `[infra/supabase/tests/rls.test.sql]` (created in R3) verifies a second `auth.users` row cannot select another user's rows.

## 5. MCP tool surface

[`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts) gains five new tools and gives two existing tools deprecation envelopes. The other 14 v0.2.0 tools are untouched.

### 5.1 New tools

| # | Tool | Inputs | Output |
|---|---|---|---|
| 17 | `read_use_case_state` | `{ use_case_id }` | Full `UseCase` object loaded from Supabase |
| 18 | `record_use_case_event` | `{ use_case_id, from_stage, to_stage, iteration, payload? }` | Inserted event row |
| 19 | `pull_recommend` | `{ use_case_id }` | Array of `Recommendation` rows the tool persisted |
| 20 | `pull_apply_artifact` | `{ use_case_id, recommendation_id }` | `Artifact` (not persisted by this tool — the dashboard persists `applications` once the user confirms) |
| 21 | `pull_analyze` | `{ use_case_id }` | Inserted `Analysis` row |

Each new tool follows the same fail-open contract as v0.2.0 `audit_page` and `generate_brief`: on Claude CLI parse failure, the tool returns a deterministic stub with a `claude_run_id` of `null` and a human-readable `notes` field. The verdict for stub analyses is `stub`.

### 5.2 Deprecation envelopes

`track_citations` (line 600 in [`mcp/src/tools/index.ts`](../../mcp/src/tools/index.ts)) and `read_citation_trend` (line 898) keep their tool registration so existing callers do not crash, but every invocation returns:

```json
{ "ok": false, "error": "deprecated_v0_3_0", "message": "Measurement leaves the plugin in v0.3.0; use the dashboard to record observations." }
```

A test in `[mcp/tests/v0.3.0.test.ts]` asserts this exact envelope.

## 6. Supabase access from MCP vs from the dashboard

- The **dashboard** owns all writes triggered directly by user actions: `use_cases`, `use_case_events`, `applications` (after the user confirms they applied an artifact), `measurements` (the form is the only entry point).
- **MCP** owns all writes that are downstream of a Claude CLI call: `recommendations` (written by `pull_recommend`), `analyses` (written by `pull_analyze`).
- Both surfaces use the same Supabase service-role key, kept on the server side (never shipped to the browser). The dashboard's server actions use the user's row-level-security session; MCP uses the service-role key (necessary because MCP is a separate process and does not hold the user's auth cookie). Every MCP write includes the explicit `user_id` it received as part of its arguments, and a Postgres trigger asserts `user_id = (use_cases.user_id)` on insert into `recommendations`/`analyses`/`applications` so the service-role key cannot escalate beyond the owning user.

## 7. Plugin command surface

[`plugin/commands/`](../../plugin/commands/) gains five `pull-*` files (R5):

```
plugin/commands/
├── aeo-audit.md       (v0.2.0, kept)
├── aeo-bootstrap.md   (v0.2.0, kept)
├── aeo-compete.md     (v0.2.0, kept)
├── aeo-fix.md         (v0.2.0, kept)
├── aeo-loop.md        (v0.2.0, kept)
├── aeo-status.md      (v0.2.0, kept)
├── aeo-track.md       (v0.2.0, kept)
├── pull-recommend.md  (v0.3.0, NEW — /pull:recommend use_case_id=<id>)
├── pull-apply.md      (v0.3.0, NEW — /pull:apply use_case_id=<id> rec_id=<id>)
├── pull-measure.md    (v0.3.0, NEW — /pull:measure use_case_id=<id>)
├── pull-analyze.md    (v0.3.0, NEW — /pull:analyze use_case_id=<id>)
└── pull-state.md      (v0.3.0, NEW — /pull:state use_case_id=<id>)
```

Plus a new agent at `[plugin/agents/pull-orchestrator.md]` that owns the recommend → apply → measure → analyze loop, but only acts on stage transitions surfaced by the frontend (the agent is **reactive**, not autonomous).

## 8. Frontend route surface

[`apps/web/app/`](../../apps/web/app/) gains use-case-centric routes:

```
apps/web/app/
├── login/page.tsx                          (NEW — Supabase magic-link)
├── dashboard/page.tsx                      (NEW — list of user's use cases)
├── use-cases/
│   ├── new/page.tsx                        (NEW — create wizard)
│   └── [id]/
│       ├── page.tsx                        (NEW — stage panel + history)
│       └── measurements/new/page.tsx       (NEW — observation form)
├── sites/* (v0.2.0 routes, kept under "Archive" tab)
└── page.tsx                                (MODIFIED — landing redirects to /dashboard or /login)
```

## 9. Auth model

- Supabase magic-link sign-in. No password.
- The auth shim at [`apps/web/lib/auth.ts`](../../apps/web/lib/auth.ts) is replaced. The exported `AuthUser` interface is preserved so widgets that import it (e.g. [`apps/web/components/widgets/site-summary.tsx`](../../apps/web/components/widgets/site-summary.tsx)) compile without changes.
- A `LLM_SEO_LAB_AUTH_ENABLED=0` escape hatch keeps the v0.2.0 single-user local-dev experience working for users who do not want Supabase: in that mode the dashboard shows a banner and disables `/use-cases/*` routes, falling back to the `/sites/*` archive only.

## 10. Configuration

Three new env vars (documented in [`README.md`](../../README.md) and [`scripts/install.sh`](../../scripts/install.sh) during R7):

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_ANON_KEY` — public anon key, exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key, used by MCP and Next.js server actions.

Plus the existing v0.2.0 vars (`MCP_HTTP_URL`, etc.) are preserved.

## 11. Dependencies added

[`apps/web/package.json`](../../apps/web/package.json) gains:

- `@supabase/supabase-js`
- `@supabase/ssr` (for the server/client split)

[`mcp/package.json`](../../mcp/package.json) gains:

- `@supabase/supabase-js` (server-side use only)

No other new runtime dependencies are introduced. Adapters use only Node built-ins plus what is already in the repo.

## 12. Tests added in v0.3.0

- [`mcp/tests/v0.3.0.test.ts`](../../mcp/tests/v0.3.0.test.ts) — cross-process invocation of the 5 new tools + the 2 deprecation envelopes.
- [`plugin/scripts/adapters/web.test.ts`](../../plugin/scripts/adapters/web.test.ts), `substack.test.ts`, `youtube.test.ts` — adapter unit tests with fixture URLs.
- [`apps/web/lib/supabase/server.test.ts`](../../apps/web/lib/supabase/server.test.ts) — server client construction + RLS deny-test sanity (using `@supabase/supabase-js` against a local Supabase).
- [`apps/web/lib/substrate.test.ts`](../../apps/web/lib/substrate.test.ts) — substrate auto-detection.
- [`infra/supabase/tests/rls.test.sql`](../../infra/supabase/tests/rls.test.sql) — Postgres-side RLS deny-test.

All v0.2.0 tests continue to run in `npm test`.
