# Changelog

All notable changes to `llm-seo-lab` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0 minor bumps may include breaking changes; we will note them explicitly.

## [Unreleased]

(Nothing yet — `v0.2.0` cut on 2026-04-25.)

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
