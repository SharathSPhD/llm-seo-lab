# Changelog

All notable changes to `llm-seo-lab` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0 minor bumps may include breaking changes; we will note them explicitly.

## [Unreleased]

(Nothing yet — `v0.4.0` sweep is in flight; see the `[0.4.0]` stub below.)

## [0.4.0] — In flight (2026-04-26 → 2026-04-27) — "Skip Vercel/Supabase, move to Cloudflare D1 + GitHub OAuth"

This release replaces the v0.3.0 dashboard backend (Supabase + Vercel) with
**Cloudflare Pages + D1 (SQLite) + GitHub OAuth**, while preserving the
v0.3.0 product surface bit-for-bit (8 stages, 5 MCP tools, 3 substrate
adapters, 5 plugin commands, measurement form). It honours the project's
"no per-token API, no paid managed backends, JSONL-canonical state"
constraint by making `data/use-cases/<id>/state.jsonl` the canonical
source of truth, with SQLite as the local cache and D1 as the optional
hosted mirror. Local Claude Code CLI continues to drive the inventive
layer; a new `pending_actions` queue lets the hosted dashboard enqueue
intents that the local plugin's new `/pull:sync` command picks up.

### Planned in v0.4.0 (R8.1 - R8.7 ralph sweep)

- **`packages/state/` workspace** (R8.2) — `StateDriver` interface plus
  `JsonlSqliteDriver` (local) and `D1HttpDriver` (hosted), with full
  driver tests; `infra/d1/migrations/0001_init.sql` for the SQLite
  schema; `scripts/import-jsonl.mjs`, `scripts/export-jsonl.mjs`,
  `scripts/sync-d1.mjs`, `scripts/import-d1.mjs` for JSONL ↔ SQLite ↔
  D1 sync.
- **Supabase removed** (R8.3) — `apps/web/lib/supabase/`,
  `apps/web/app/auth/callback/route.ts`, `apps/web/app/login/{page,actions}.tsx`
  (Supabase magic-link flavor), `infra/supabase/`, and the `@supabase/*`
  dependencies are deleted. `mcp/src/tools/v030.ts` and
  `apps/web/lib/actions/use-cases.ts` are refactored to call
  `StateDriver` instead of Supabase.
- **GitHub OAuth + JWT session** (R8.4) — new
  `apps/web/app/auth/github/{authorize,callback}/route.ts` and
  `apps/web/app/auth/logout/route.ts`; new
  `apps/web/lib/auth/github.ts` (HS256 JWT via `jose`); rewritten
  `apps/web/lib/auth.ts` and `/login` page; `LLM_SEO_LAB_AUTH=local`
  shim preserved bit-for-bit.
- **Cloudflare Pages adapter** (R8.5) — `@cloudflare/next-on-pages`
  added; `wrangler.toml` at the repo root with the `LLM_SEO_LAB_DB`
  D1 binding; `cf:build` script; `apps/web/functions/api/sync.ts`
  Pages Function for local-to-D1 push (auth: signed JWT).
- **Pending-actions intent queue** (R8.6) — new `pending_actions`
  table, hosted-dashboard buttons enqueue intents instead of calling
  MCP, new plugin command `/pull:sync` (read-only on D1 except for
  `mark_action_executed`), and two new MCP tools
  `read_pending_actions` and `mark_action_executed`. Plugin manifests
  bumped to `0.4.0`.
- **End-to-end verification** (R8.7) — all v0.2.0 + v0.3.0 + new
  v0.4.0 tests pass; live OAuth + Pages Functions preview verified;
  README quickstart works on a clean clone; `project-overview.html`
  v0.4.0 nav group + sections added; final `docs/ralph-runs/v0.4.0/R8.md`
  ratifies the sweep as GREEN.

### Breaking changes (versus v0.3.0)

- Auth substrate is **GitHub OAuth**, not Supabase magic-link. Users
  without GitHub accounts must use `LLM_SEO_LAB_AUTH=local`.
- All `SUPABASE_*` env vars are removed. New env vars:
  `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
  `SESSION_JWT_SECRET`, `LLM_SEO_LAB_BASE_URL`, plus the
  `LLM_SEO_LAB_DB` D1 binding in `wrangler.toml`.
- The Postgres `assert_user_owns_use_case` trigger no longer exists;
  ownership is enforced in the `StateDriver` layer.
- The hosted dashboard cannot trigger Claude CLI directly; it enqueues
  `pending_actions` rows that the local plugin's `/pull:sync` command
  picks up.
- Anyone needing the v0.3.0 Supabase reference implementation should
  `git checkout v0.3.0`. The v0.3.0 git tag is preserved.

### Frozen (untouched by v0.4.0)

- All v0.3.0 documentation under `docs/v0.3.0/` and ralph reports
  `docs/ralph-runs/v0.3.0/R1.md..R7.md`.
- All v0.2.0 ralph reports under `docs/ralph-runs/R1.md..R7.md`.
- v0.2.0 use-case reports under `docs/use-cases/P1..P5*.md` and
  `docs/use-cases/P3-live-run-2026-04-25/`.
- The v0.2.0 / v0.3.0 sections of `project-overview.html`. v0.4.0
  lands as an additive companion section.

## [0.3.0] — 2026-04-26 — "Citation-pull reorientation"

This release reorients the project around a new question: **how does any
page — owned, hosted, or third-party — pull AI-engine citations more
strongly over time?** The v0.2.0 closed-loop competitor-gap PR system
remains intact and shipped as one tactic; v0.3.0 adds a substrate-
agnostic, time-spread, human-gated **`/pull:*` mode** alongside it.
Measurement leaves the plugin entirely — users observe citations on
ChatGPT, Perplexity, Google AIO, Claude.ai, and Gemini themselves and
self-report via a Supabase-backed dashboard.

### Added
- **Citation-pull TRIZ + attractor-flow + Pratyakṣa charter** — a fresh
  inventive run against the new contradiction (page must be pulled by
  AI engines without depending on Wikipedia / Reddit / domain-authority
  real estate). Five charter principles ratified:
  `atomic-snippet-density`, `semantic-anchor-stability`,
  `q-shaped-subhead-lattice`, `cross-engine-intermediary`,
  `inverted-retrieval-target`. Decision recorded at
  `docs/decisions/2026-04-26-citation-pull-charter.md`. Supporting
  artifacts under `docs/triz/v0.3.0-pull-*`.
- **Per-use-case state machine** — `DRAFT → RECOMMENDED → APPLIED →
  REPUBLISHED → MEASURING → MEASURED → ANALYZED → RECOMMENDED'`. Every
  transition is human-triggered from the dashboard; the plugin only
  acts on transitions. Spec at `docs/v0.3.0/spec.md` §3.2.
- **Five new MCP tools**: `pull_recommend`, `pull_apply_artifact`,
  `pull_analyze`, `read_use_case_state`, `record_use_case_event`. Plus
  v0.3.0 deprecation envelopes on `track_citations` and
  `read_citation_trend` (kept registered, return
  `{ok:false, error:"DEPRECATED_V030"}`).
- **Three substrate adapters** under `plugin/scripts/adapters/`:
  - `web` — git-PR diff, voice profile `clinical-and-cited`.
  - `substack` — paste-ready markdown + diff report, voice
    `conversational-and-anecdotal`.
  - `youtube` — YouTube-Studio checklist (title / description / tags /
    chapter timestamps / pinned comment / end card), voice
    `direct-and-ephemeral`.
- **Five new plugin commands** (`/pull:recommend`, `/pull:apply`,
  `/pull:measure`, `/pull:analyze`, `/pull:state`) and a new
  `pull-orchestrator` agent. Manifests at
  `plugin/.claude-plugin/plugin.json` and
  `plugin/.cursor-plugin/plugin.json` bumped to **0.3.0**.
- **Supabase auth + multi-user dashboard** in `apps/web/`:
  - Magic-link sign-in at `/login` plus `/auth/callback`.
  - `/dashboard` lists the signed-in user's use cases.
  - `/use-cases/new` wizard with substrate auto-detection (web /
    substack / youtube) and manual override.
  - `/use-cases/[id]` stage panel with action buttons that invoke
    server actions hitting MCP (recommend, mark applied, republished,
    start measuring, submit observations, analyze, next iteration,
    abandon).
  - `/use-cases/[id]/measurements/new` — user-reported engine
    observation form (engine, prompt, observed answer, citation
    presence, position, source authority, notes, screenshot path).
- **Supabase migration** at `infra/supabase/migrations/0001_init.sql`
  with `profiles`, `use_cases`, `use_case_events`, `recommendations`,
  `applications`, `measurements`, `analyses`, all gated by RLS
  (`user_id = auth.uid()`).
- **Three real seed use cases** under `data/use-cases/`:
  - `u1-technektar-dev` (`https://www.technektar.dev`, web) → DRAFT →
    RECOMMENDED.
  - `u2-technektar-substack-context-window`
    (`https://technektar.substack.com/p/when-the-context-window-is-big-and`,
    substack) → DRAFT → RECOMMENDED → APPLIED → REPUBLISHED →
    MEASURING → MEASURED → ANALYZED with three engine observations.
  - `u3-youtube-fM2hpqPx8zg`
    (`https://youtu.be/fM2hpqPx8zg`, youtube) → DRAFT →
    RECOMMENDED → APPLIED.
  - Offline `state.jsonl` mirror generated deterministically by
    `scripts/seed-use-cases.mjs`.
- **R1–R7 ralph-loop reports** under `docs/ralph-runs/v0.3.0/`.

### Changed
- **`apps/web/lib/auth.ts`** — replaced the local-dev shim with a real
  Supabase server-side getUser pattern; the previous `AuthUser`
  interface is preserved so existing widgets compile unchanged. When
  `LLM_SEO_LAB_AUTH=local`, the local-dev user remains.
- **`apps/web/components/nav.tsx`** — async server component; shows
  the signed-in user's email + sign-out, or a login link, alongside
  Dashboard / Use cases / v0.2.0 archive nav items.
- **`apps/web/app/page.tsx`** — redirects signed-in users to
  `/dashboard` and unauthenticated users to `/login` in Supabase mode.
- **`mcp/src/tools/v030.ts`** — refactored to delegate per-substrate
  recommendation + artifact construction to the
  `plugin/scripts/adapters/*.ts` adapters via the shared
  `SubstrateAdapter` interface in `packages/shared`.
- **`scripts/aeo-live-run.mjs`** gained a `--use-case` flag to drive
  the new flow alongside the existing `--site` flow.

### Removed (deprecated, not deleted)
- `track_citations` and `read_citation_trend` MCP tools are kept
  registered for backward compatibility but always return the
  v0.3.0 deprecation envelope. Phase-6 simulation benchmark and the
  Playwright citation crawler stub are archived under their existing
  paths; no v0.3.0 flow invokes them.

### Frozen (untouched by v0.3.0)
- All v0.2.0 ralph reports under `docs/ralph-runs/R1.md…R7.md`.
- v0.2.0 use-case reports under `docs/use-cases/P1…P5*.md` and
  `docs/use-cases/P3-live-run-2026-04-25/`.
- The v0.2.0 sections of `project-overview.html`. v0.3.0 lands as an
  additive companion section.

### Known limitations
- Cloud-hosted dashboard is still local-first; deploy to Vercel is
  v0.4.0.
- Auto-publishing to Substack / YouTube is intentionally out of scope —
  artifacts are paste-ready by design.
- Cursor marketplace publication for the v0.3.0 plugin remains alpha.
- The dashboard does not crawl any AI engine; user-reported
  observations are the sole measurement substrate.

## [0.2.0] — 2026-04-25 — "Closed loop, real PR, witness gate"

This release closes the integration drift the adversarial architecture
review (`docs/reviews/2026-04-25-adversarial-architecture-review.md`)
flagged, upgrades the plugin to a real dual-target Cursor + Claude
Code CLI plugin, integrates the Pratyakṣa epistemology gate via TRIZ-
+ attractor-flow-driven adoption analysis, and proves the loop end-
to-end by opening a real PR against a Phase-7 site.

### Added
- **Pratyakṣa Buddhi gate** wired into the AEO loop runner
  (`packages/cli-worker/src/runners/loop.ts`). Manas drafts the brief
  via `claude --print`; Buddhi calls `pratyaksha.context_retrieve`,
  `pratyaksha.detect_conflict`, and `pratyaksha.sublate_with_evidence`
  before `open_pr`. Adoption rationale in
  `docs/decisions/2026-04-26-pratyaksha-integration.md`.
- **Sākṣī (witness) hook** at `plugin/scripts/aeo-sakshi.sh`. Pins the
  AEO invariants ("subscription-only Claude CLI; no synthetic
  citations; never overwrite a recommendation, sublate it") at
  `SessionStart`.
- **Live PR mode** for the `open_pr` MCP tool: clones the customer
  repo into a temp dir, writes one `docs/aeo-briefs/<brief_id>.md`
  per cleared brief, commits as `llm-seo-lab[bot]`, pushes, and runs
  `gh pr create`.
- **Read-side MCP tools** the web layer was already calling: `list_sites`,
  `read_latest_audit`, `list_prs`, `read_citation_trend`.
- **Dual-target plugin manifest** — `plugin/.claude-plugin/plugin.json`
  alongside `plugin/.cursor-plugin/plugin.json`, plus
  `.claude-plugin/marketplace.json` at the repo root.
- **Live-run reference harness** `scripts/aeo-live-run.mjs` — one-shot
  end-to-end driver that streams every loop event into
  `docs/use-cases/<run_id>/transcript.jsonl`.
- **Phase-7 evidence package** `docs/use-cases/P3-live-run-2026-04-25/`
  with the resulting PR at
  <https://github.com/SharathSPhD/SharathSPhD.github.io/pull/1>.
- **Cross-process tripwire test** `mcp/tests/pratyaksha.integration.test.ts`
  asserting witness + sublation contracts against the real Python
  Pratyakṣa MCP server. Runs in CI (with `uv` provisioned in the job).
- **TRIZ + attractor-flow R3 artifacts** — contradiction cards, session
  log (`.triz/session.jsonl`), and per-candidate trajectory analysis
  in `docs/triz/r3-pratyaksha-attractor.json`.
- **`docs/limitations.md`** — honest scope statement: Playwright
  citation tracker is still stubbed, audit/brief content can fall
  back to a deterministic stub, T+14 lift is not yet measured.
- **Per-phase ralph-loop completeness reports** under `docs/ralph-runs/`.

### Changed
- **MCP HTTP transport** standardised on `POST http://127.0.0.1:7301/rpc`.
  The web layer used to call `:7374/mcp`; this release reconciles every
  caller (`apps/web`, `cli-worker`, `scripts/aeo-live-run.mjs`).
- **`audit_page` and `generate_brief`** are now fail-open: when the
  Claude CLI errors or returns unparseable output, both return a
  deterministic stub clearly marked `claude_model: "fallback-stub"`
  so the loop can still produce a reviewable PR. Strict-path tests
  remain in `mcp/tests/tools.test.ts`.
- **Loop runner result envelope** — added a `buddhi` block that
  records `pratyaksha_available`, `conflicts_detected`,
  `sublations_recorded`, and `blocked_briefs`. Added a
  `next_step: "buddhi_blocked"` terminal state.
- **`scripts/install.sh`** rewritten: dropped the spurious
  `uv pip install -e .` against `mcp/` (mcp/ is TypeScript), added
  `gh` auth check, added `uv` check, and added `git submodule update`
  bootstrap so the Pratyakṣa gate works out of the box.
- **README** rewritten for the v0.2.0 reality: dual-target plugin
  install path, live-run quickstart, link to the first real PR,
  Pratyakṣa dependency surfaced, single canonical port/path for MCP.

### Fixed
- `apps/web/lib/mcp-client.ts` no longer points at the wrong
  `:7374/mcp` endpoint.
- `cli-worker/src/runners/loop.ts` now unwraps the `{ok, value}`
  envelope consistently and uses the real MCP tool argument names
  (`page_url`, `repo_path`, etc.) instead of the legacy `site_id`-
  only signatures.
- Hooks under `plugin/scripts/` no longer rely on the missing GNU
  `timeout` binary on macOS — they handle their own timeouts via an
  embedded Python `subprocess.Popen`.

### Known limitations (full list in `docs/limitations.md`)
- Playwright citation crawler still stubbed; T+14 lift not measured.
- Audit/brief content can be a `fallback-stub` if the Claude CLI does
  not return a fenced JSON block.
- Pratyakṣa Buddhi gate degrades to no-op when `uv` is missing.
- One Phase-7 site captured (the pattern is reusable for the other four).
- Cursor marketplace publication intentionally deferred — install via
  `/plugin marketplace add <local-path>`.

## [0.1.0-alpha.1] — 2026-04-25 — "Phase 5 build complete"

The first end-to-end build of the platform. All five worktrees from the implementation plan are integrated under the monorepo and gated by `/ralph-loop`.

### Added
- **Skills bundle** (`skills/`) — six Claude Code skills: `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel`, plus a Python harness with pytest coverage.
- **MCP server** (`mcp/`) — 12 JSON-RPC tools (`audit_page`, `track_citations`, `generate_brief`, `emit_schema`, `compare_competitors`, `oracle_query`, `read_config`, `open_pr`, `list_sites`, `get_site_audit`, `get_pr_queue`, `get_citation_trend`) and 3 widgets, with worker pools, token-bucket rate limiting, a typed error envelope, and an end-to-end test.
- **Cursor plugin** (`plugin/`) — manifest, seven commands (`/aeo:bootstrap`, `/aeo:loop`, `/aeo:audit`, `/aeo:track`, `/aeo:fix`, `/aeo:results`, `/aeo:compete`), the `aeo-loop` agent, and a hook that runs the loop on demand.
- **CLI worker daemon** (`packages/cli-worker/`) — persistent JSONL-backed job queue, runner with rate limiting and graceful shutdown, WebSocket publisher for live job events, substrate registry (Git initially), and an HTTP `/health` endpoint.
- **Next.js dashboard** (`apps/web/`) — App Router pages for `/`, `/sites`, `/sites/[slug]`, and `/health`; server actions that call the MCP HTTP bridge; widgets for site summary, citation trend, and live PR queue (WebSocket).
- **Shared types package** (`packages/shared/`) — single source of truth for `SiteConfig`, gap/citation/PR DTOs, and engine identifiers.
- **Repository scaffolding** — `.eslintrc`, Prettier, root `tsconfig.base.json`, GitHub Actions workflow, monorepo workspaces.

### Methodology
- TRIZ contradiction cards and ARIZ-85C session log under `docs/triz/`.
- Attractor-flow convergence trajectory recorded across the design phase.
- Spec, PRD (with pricing tiers), plugin architecture, MCP design, and writing-plans implementation plan reviewed and gated by `/ralph-loop`.
- Three parallel research subagent outputs in `docs/research/` (competitor matrix, citation mechanisms, GEO evidence base) plus a baseline `/seo-audit` report against the validation sites.

### Known limitations
- Citation oracle uses Claude Code CLI as the primary source with a Playwright fallback for public Perplexity/ChatGPT UIs; coverage of Google AIO and Gemini will land in the next milestone.
- Statistical benchmarking (Phase 6) and real-site validation (Phase 7) deliverables are not yet in this tag.
