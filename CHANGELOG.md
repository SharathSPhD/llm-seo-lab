# Changelog

All notable changes to `llm-seo-lab` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0 minor bumps may include breaking changes; we will note them explicitly.

## [Unreleased]

### Added
- One-shot installer script `scripts/install.sh` (Node + Python + Claude Code CLI verification, npm workspace install, `uv sync` fallback to `pip`).
- End-to-end smoke test `scripts/smoke.mjs` (`npm run smoke`) that boots the cli-worker daemon on ephemeral ports, hits `/health`, performs a WebSocket handshake, and asserts a clean `SIGTERM` exit.
- README quickstart with default ports table and useful-scripts cheatsheet.

### Changed
- `cli-worker` `daemon start` now blocks until `SIGTERM`/`SIGINT` instead of exiting immediately, so the daemon can actually serve requests when launched from `npm start` or `install.sh`.
- Reconciled default ports across `apps/web`, `vercel.json`, and `scripts/install.sh` to match the cli-worker defaults: HTTP `/health` on `7303`, WebSocket on `7302`.

### Fixed
- `apps/web/tsconfig.json` no longer pulls shared-package test files into the web typecheck (`rootDir` and `include` reduced to the app's own sources).
- `next.config.ts` moves `typedRoutes` out of `experimental` (Next.js 15 deprecation).

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
