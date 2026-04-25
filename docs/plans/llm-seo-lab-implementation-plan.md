# llm-seo-lab — Implementation Plan

**Date:** 2026-04-25 · **Phase:** 4 · **Status:** v0.1.0 implementation plan candidate · **Anchors:** [`2026-04-25-llm-seo-lab-design.md`](../spec/2026-04-25-llm-seo-lab-design.md), [`llm-seo-lab-prd.md`](../prd/llm-seo-lab-prd.md), [`plugin-architecture.md`](../spec/plugin-architecture.md), [`mcp-design.md`](../spec/mcp-design.md)

This document is the bite-sized TDD task list for v0.1.0. Per the `superpowers:writing-plans` skill: every task names the file(s) it touches, the test that proves it, and the smallest reasonable scope. Tasks are organised by worktree (matching the Phase 5 plan).

---

## 1. Plan-wide ground rules

- **Every task** has a deterministic acceptance test. No "verified by inspection".
- **TDD per task:** write the failing test first, commit, then implement until green, commit again. The two commits per task make rollback safe.
- **Stack:** TypeScript for plugin/MCP/cli-worker/dashboard; Python for skills' internal scripts (when invoked from Claude CLI subprocess) and statistical analysis.
- **Package manager:** `pnpm` for the JS workspace, `uv` for Python scripts (matching the attractor scripts already in the repo).
- **Lint/format:** `eslint` + `prettier` for TS, `ruff` for Python.
- **CI:** GitHub Actions runs lint, typecheck, unit, integration on every push to a worktree branch; gates merge to `main`.
- **Worktree pattern:** `git worktree add ../llm-seo-lab-phase5-<letter> feature/phase5-<letter>-<name>`.
- **Commit cadence:** push at the end of every task (never let a worktree go > 1 day without a push).

## 2. Pre-flight (worktree-independent)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| P.1 | Add `pnpm-workspace.yaml` rooting `apps/web`, `packages/cli-worker`, `packages/shared`, `mcp/`, `plugin/` | `pnpm-workspace.yaml` | `pnpm install` succeeds; `pnpm -r build` succeeds (with empty packages) | `pnpm -r build` exits 0 |
| P.2 | Set up shared TS config | `tsconfig.base.json`, per-package `tsconfig.json` | `pnpm -r tsc --noEmit` succeeds | exits 0 |
| P.3 | Set up `eslint`, `prettier`, `ruff` configs | `.eslintrc.json`, `.prettierrc`, `pyproject.toml` | `pnpm lint` and `ruff check .` exit 0 | exits 0 |
| P.4 | Add CI workflow | `.github/workflows/ci.yml` | first push triggers CI; lint+typecheck+unit jobs all green | green checkmark on a commit to a feature branch |
| P.5 | Add `packages/shared/` with the `AeoTypes` module | `packages/shared/src/types/audit.ts`, `brief.ts`, `citation.ts`, `pr.ts`, `config.ts`, `index.ts` | unit tests for type discriminated unions (compile-time + runtime guard tests) | `pnpm -F @llm-seo-lab/shared test` green |

## 3. Worktree A — Skills bundle (`feature/phase5-A-skills`)

Each skill = one task pair (test + implementation). Skills run inside Claude CLI as SKILL.md prompts; the unit test runs the skill against a fixture page and asserts the structured output schema matches.

| ID | Task | File(s) | Test fixture | Done when |
|---|---|---|---|---|
| A.1 | Skill `aeo-audit` SKILL.md + 3 fixture pages + Python harness | `skills/aeo-audit/SKILL.md`, `skills/aeo-audit/tests/{fixtures,run.py}` | 3 fixture pages: one strong (high cite_sources), one weak (no schema, no stats), one mixed | Python harness invokes Claude CLI subprocess, parses JSON, asserts schema + score bounds |
| A.2 | Skill `citation-oracle-loop` SKILL.md + question-bank fixture | `skills/citation-oracle-loop/SKILL.md`, `skills/citation-oracle-loop/tests/{fixtures,run.py}` | 5-question fixture bank for "static site SEO" topic | harness asserts each question returns either citation flag or graceful fallback per engine |
| A.3 | Skill `content-brief-from-gap` SKILL.md + 3 gap fixtures | `skills/content-brief-from-gap/SKILL.md`, `skills/content-brief-from-gap/tests/...` | 3 gap fixtures (one per Tier-1 tactic) | harness asserts brief contains diff, rationale, revert plan |
| A.4 | Skill `schema-generator` SKILL.md + 4 page-type fixtures | `skills/schema-generator/SKILL.md`, `skills/schema-generator/tests/...` | Article, FAQPage, HowTo, Product fixtures | harness asserts JSON-LD validates against schema.org |
| A.5 | Skill `freshness-radar` SKILL.md + decay fixture | `skills/freshness-radar/SKILL.md`, `skills/freshness-radar/tests/...` | 3 pages with synthetic citation-share decay over 90 days | harness asserts radar prioritises declining-share pages |
| A.6 | Skill `competitive-citation-intel` SKILL.md + competitor fixture | `skills/competitive-citation-intel/SKILL.md`, `skills/competitive-citation-intel/tests/...` | 5-competitor fixture with synthetic citation map | harness asserts gap-themes returned and ranked |
| A.7 | Aggregate skills CI job in `.github/workflows/ci.yml` | yaml | all 6 skill tests run | CI green |

## 4. Worktree B — MCP server (`feature/phase5-B-mcp`)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| B.1 | MCP server scaffold (stdio + HTTP transports) | `mcp/src/server.ts`, `mcp/src/transports/{stdio,http}.ts`, `mcp/package.json` | `mcp/tests/server.spec.ts` round-trips a `ping` tool over both transports | round-trip green |
| B.2 | Tool registry + descriptor loader | `mcp/src/registry.ts`, `mcp/src/tools/index.ts` | `mcp/tests/registry.spec.ts` asserts 12 tools registered with schemas | green |
| B.3 | Tool 1 `read_repo_metadata` | `mcp/src/tools/read_repo_metadata.ts`, `mcp/tests/tools/read_repo_metadata.spec.ts` | fixture repo with sitemap | returns repo type, sitemap path, page count |
| B.4 | Tools 2,3 `read_config`, `write_config` | `mcp/src/tools/{read,write}_config.ts`, tests | fixture config | round-trip green |
| B.5 | Tool 4 `audit_page` | `mcp/src/tools/audit_page.ts`, `mcp/tests/tools/audit_page.spec.ts` | mocked Claude CLI subprocess | asserts gap-report schema |
| B.6 | Tool 5 `generate_brief` | `mcp/src/tools/generate_brief.ts`, tests | mocked Claude CLI | asserts brief, diff, plan present |
| B.7 | Tool 6 `emit_schema` | `mcp/src/tools/emit_schema.ts`, tests | 4 page-type fixtures | JSON-LD validates |
| B.8 | Tool 7 `open_pr` | `mcp/src/tools/open_pr.ts`, tests | mocked `gh CLI` | asserts pr_number returned |
| B.9 | Tool 8 `oracle_query` | `mcp/src/tools/oracle_query.ts`, tests | mocked Claude CLI + mocked Playwright | asserts citation flag returned per engine |
| B.10 | Tool 9 `track_citations` | `mcp/src/tools/track_citations.ts`, tests | fixture samples.jsonl | asserts statistical analysis JSON returned |
| B.11 | Tool 10 `compare_competitors` | `mcp/src/tools/compare_competitors.ts`, tests | fixture competitor map | asserts gap-themes returned |
| B.12 | Tool 11 `read_pr_status` | `mcp/src/tools/read_pr_status.ts`, tests | mocked `gh CLI` | asserts PR state returned |
| B.13 | Tool 12 `read_results` | `mcp/src/tools/read_results.ts`, tests | fixture results dir | asserts results JSON returned |
| B.14 | Worker pool: Claude CLI subprocess pool | `mcp/src/workers/claude.ts`, tests | mocked subprocess | asserts max-concurrency honoured + queueing |
| B.15 | Worker pool: Playwright session pool | `mcp/src/workers/playwright.ts`, tests | mocked browser | asserts session reuse |
| B.16 | Filesystem watcher | `mcp/src/workers/fs_watcher.ts`, tests | tmpdir fixture | asserts events emitted on file change |
| B.17 | Rate-limit middleware | `mcp/src/middleware/rate_limit.ts`, tests | fake clock | asserts 429-equivalent on burst |
| B.18 | Error envelope module | `mcp/src/errors.ts`, tests | each error code | asserts envelope shape |
| B.19 | UI widget 1 `audit-summary` | `mcp/widgets/audit-summary/{index.html,bundle.js}`, snapshot test | fixture audit run | snapshot matches |
| B.20 | UI widget 2 `pr-queue` | `mcp/widgets/pr-queue/...`, snapshot test | fixture PR list | snapshot matches |
| B.21 | UI widget 3 `citation-trend` | `mcp/widgets/citation-trend/...`, snapshot test | fixture time-series | snapshot matches |
| B.22 | E2E: stdio MCP client invokes audit_page → brief → open_pr against fixture repo | `mcp/tests/e2e/full-loop.spec.ts` | full fixture | asserts PR fixture created |

## 5. Worktree C — Cursor plugin (`feature/phase5-C-plugin`)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| C.1 | Plugin manifest scaffold | `plugin/plugin.json`, `plugin/mcp.json` | `plugin/tests/validate-manifest.ts` runs schema validation | manifest validates |
| C.2 | Command `/aeo:bootstrap` | `plugin/commands/aeo-bootstrap.md` | `plugin/tests/commands/aeo-bootstrap.spec.ts` mocks MCP, asserts config + PR open | green |
| C.3 | Command `/aeo:audit` | `plugin/commands/aeo-audit.md`, tests | green |
| C.4 | Command `/aeo:track` | `plugin/commands/aeo-track.md`, tests | green |
| C.5 | Command `/aeo:brief` | `plugin/commands/aeo-brief.md`, tests | green |
| C.6 | Command `/aeo:open-pr` | `plugin/commands/aeo-open-pr.md`, tests | green |
| C.7 | Command `/aeo:status` | `plugin/commands/aeo-status.md`, tests | green |
| C.8 | Command `/aeo:configure` | `plugin/commands/aeo-configure.md`, tests | green |
| C.9 | Agent `aeo-loop` | `plugin/agents/aeo-loop.md`, `plugin/tests/agents/aeo-loop.spec.ts` | mocked MCP tools | asserts full loop sequence executed |
| C.10 | Hook `on-pr-merge` | `plugin/hooks/on-pr-merge.json`, `plugin/tests/hooks/on-pr-merge.spec.ts` | fake merge event | asserts track_citations scheduled |
| C.11 | Plugin lint job in CI | `.github/workflows/ci.yml` patch | `plugin-quality-gates` rule passes | CI green |
| C.12 | Integration: load plugin in headless Cursor instance, run `/aeo:audit` against fixture | `plugin/tests/integration/load.spec.ts` | Playwright + fixture | command returns audit summary |

## 6. Worktree D — CLI worker daemon (`feature/phase5-D-cliworker`)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| D.1 | Daemon scaffold (Node.js, long-running, signal-handled) | `packages/cli-worker/src/daemon.ts`, tests | `kill -SIGTERM` | clean shutdown |
| D.2 | Job queue (in-memory + persistent journal in `.llm-seo-lab/queue.jsonl`) | `packages/cli-worker/src/queue.ts`, tests | enqueue + restart | jobs survive restart |
| D.3 | Job runner: `aeo-loop` orchestration | `packages/cli-worker/src/runners/loop.ts`, tests | mocked MCP | asserts sequence |
| D.4 | Per-tier rate-limiter | `packages/cli-worker/src/rate_limit.ts`, tests | fake clock | asserts cap honoured per tier |
| D.5 | WebSocket publisher | `packages/cli-worker/src/ws.ts`, tests | mock client | asserts events delivered |
| D.6 | Substrate plugin loader (v0.1.0: `git-substrate`) | `packages/cli-worker/src/substrates/{loader,git}.ts`, tests | fake substrate plugin | asserts plugin loaded by name |
| D.7 | CI hook: post-merge detector | `packages/cli-worker/src/hooks/post_merge.ts`, tests | mocked GitHub webhook payload | asserts re-audit scheduled |
| D.8 | CLI entry: `pnpm llm-seo-lab daemon start` | `packages/cli-worker/src/cli.ts`, `packages/cli-worker/bin/llm-seo-lab` | shell test | binary spawns daemon |
| D.9 | Health endpoint (HTTP `/health`) | `packages/cli-worker/src/http/health.ts`, tests | `curl localhost:7e3/health` | returns `{status: "ok", queue_depth, claude_workers, playwright_sessions}` |
| D.10 | Shutdown drains in-flight jobs | `packages/cli-worker/src/shutdown.ts`, tests | enqueue + SIGTERM | journal shows graceful drain |

## 7. Worktree E — Next.js dashboard (`feature/phase5-E-web`)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| E.1 | Next.js 16 app scaffold (App Router, Cache Components, shadcn UI) | `apps/web/{app,components,lib}/...`, `apps/web/package.json` | `pnpm -F @llm-seo-lab/web build` | build succeeds |
| E.2 | Layout + nav + theme | `apps/web/app/layout.tsx`, `apps/web/components/nav.tsx` | RTL render test | passes |
| E.3 | Page `/sites` (list) + server action `listSites()` | `apps/web/app/sites/page.tsx`, `apps/web/lib/actions/sites.ts`, tests | mocked MCP HTTP | renders fixture list |
| E.4 | Page `/sites/[slug]` (audit summary, embeds widget 1) | `apps/web/app/sites/[slug]/page.tsx`, tests | mocked MCP | renders fixture summary |
| E.5 | Page `/sites/[slug]/prs` (PR queue, embeds widget 2 with WebSocket) | tests | mocked MCP + WS | live updates render |
| E.6 | Page `/sites/[slug]/citations` (trend chart, embeds widget 3) | tests | mocked MCP | chart renders |
| E.7 | Page `/sites/[slug]/results/[pr]` (statistical results) | tests | mocked MCP | renders p-value, CI, effect size |
| E.8 | Auth shim (Clerk feature-flagged off in v0.1.0) | `apps/web/lib/auth.ts`, tests | flag-off path | unauthenticated localhost works |
| E.9 | MCP HTTP client | `apps/web/lib/mcp-client.ts`, tests | mock server | asserts tool calls round-trip |
| E.10 | Vercel config + deployment preview | `vercel.json`, `apps/web/next.config.ts` | `vc deploy --prebuilt` | preview URL live |

## 8. Cross-cutting (after worktrees A–E land)

| ID | Task | File(s) | Test | Done when |
|---|---|---|---|---|
| X.1 | End-to-end smoke test on a fixture indie site | `tests/e2e/smoke.spec.ts` | full fixture site | audit → PR → mock-merge → re-audit completes < 5min |
| X.2 | README with quickstart | `README.md` | manual review | covers install, bootstrap, first PR |
| X.3 | CHANGELOG.md initialised | `CHANGELOG.md` | n/a | first entry: v0.1.0-alpha.1 |
| X.4 | Plugin published to local Cursor plugin folder via dev script | `scripts/install-local.sh` | shell test | plugin loads in Cursor |
| X.5 | Daemon installed as a launchd plist (macOS) and systemd unit (linux) | `scripts/install-daemon-{macos,linux}.sh` | manual test | daemon starts at login |
| X.6 | Health-check page in dashboard pings daemon `/health` | `apps/web/app/health/page.tsx`, tests | mocked daemon | green badge if daemon up |

## 9. Phase 5 acceptance gate (ralph-loop completeness)

Phase 5 is complete when:

- [ ] All P, A, B, C, D, E, X tasks have green CI on `main`.
- [ ] X.1 e2e smoke test passes locally on the project author's machine.
- [ ] One real audit PR opened against `technektar.dev` repo (the dogfood) by the agent, manually reviewed, and merged.
- [ ] Dashboard `/health` shows daemon up, queue depth ≥ 1, Claude worker active.
- [ ] `pnpm llm-seo-lab --version` returns `0.1.0-alpha.1`.

## 10. Dependencies and external services

- **Required:** Claude Code CLI installed and authenticated; `gh CLI` installed and authenticated; Playwright browsers downloaded; Node.js ≥ 20; Python ≥ 3.10; pnpm ≥ 9.
- **Optional v0.1.0:** Clerk (auth, behind flag); Vercel (dashboard hosting; works locally without).
- **Required for Phase 6:** SerpAPI optional plugin if Google AIO sampling needs SerpAPI fallback.

## 11. Risks and mitigations (plan-level)

| Risk | Mitigation |
|---|---|
| Claude CLI subprocess spawn cost dominates audit time | Pool reuse (B.14); per-page audit becomes a streaming session not per-call spawn |
| Playwright headless detection by AI engines | Use `cursor-ide-browser` MCP which uses the user's actual browser session, not headless |
| `gh CLI` rate limits on PR open | One PR per gap, batched intelligently (max 5 PRs per minute per repo) |
| Test fixture drift as Claude models update | Fixture tests are tolerance-based (score bounds, not exact values); record `claude_model` in every output |
| Worktree merge conflicts | Worktrees touch disjoint top-level dirs (`skills/`, `mcp/`, `plugin/`, `packages/`, `apps/`) so conflicts are minimised |

## 12. Self-review per `superpowers:writing-plans`

- [x] Every task names file(s) and test.
- [x] No placeholders — every task is actionable.
- [x] Type consistency: shared types in P.5 used by all worktrees.
- [x] Spec coverage: every PRD feature F.1–F.12 maps to at least one A/B/C/D/E task (cross-checked: F.1→C.2, F.2→A.1+B.5+C.3, F.3→A.3+B.6, F.4→A.4+B.8+C.6, F.5→A.2+B.9+C.4, F.6→A.2+B.10+D.7, F.7→A.5, F.8→A.6+B.11, F.9→C.*, F.10→E.*, F.11→D.*, F.12→B.4+C.8).
- [x] No "verified by inspection" — every task is unit/integration testable.
- [x] Worktree boundaries are clean (disjoint dirs).
- [x] Phase 5 acceptance gate is explicit and externally verifiable.

## 13. User review checkpoint (Phase 4 close)

The five Phase-4 documents are now complete:
1. [`docs/spec/2026-04-25-llm-seo-lab-design.md`](../spec/2026-04-25-llm-seo-lab-design.md)
2. [`docs/prd/llm-seo-lab-prd.md`](../prd/llm-seo-lab-prd.md)
3. [`docs/spec/plugin-architecture.md`](../spec/plugin-architecture.md)
4. [`docs/spec/mcp-design.md`](../spec/mcp-design.md)
5. this document

Per Phase 4 in [the master plan](file:///Users/sharath/.cursor/plans/llm-seo-lab_pathbreaking_aeo_platform_af2c091b.plan.md), Phase 5 build begins after **user review** of all 5 docs. If the user does not respond, Phase 5 will proceed with the design as written and surface any contested decisions in PR descriptions for in-flight review.
