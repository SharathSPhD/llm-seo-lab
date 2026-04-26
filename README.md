# llm-seo-lab

> Path-breaking AEO / LLM-SEO platform. Closed-loop autonomous citation engineering powered by the Claude Code CLI subscription (no per-token API), TRIZ-driven design, and attractor-flow orchestration.

## What this is

The AEO / GEO / LLM-SEO category in 2026 is dominated by **monitoring dashboards** (AthenaHQ, Profound, Otterly.AI, Peec.ai, Geol.ai, Goodie, Search Party, SerpAPI). They surface visibility gaps but they do not close them. `llm-seo-lab` exists to close that loop: detect the gap, generate the fix, publish the artifact, verify the citation lift.

## v0.3.0 — citation-pull mode (current)

`v0.3.0` adds a second, substrate-agnostic mode alongside the v0.2.0
competitor-gap loop. The new question is: **how does *any* page — owned,
hosted, or third-party — pull AI-engine citations more strongly over
time, regardless of whether it lives on Wikipedia or Reddit real
estate?**

Three substrates are first-class: **web** (own domain), **substack**
(post URL), **youtube** (video). For each, the plugin runs a fresh
TRIZ + attractor-flow + Pratyakṣa pipeline against five charter
principles — `atomic-snippet-density`, `semantic-anchor-stability`,
`q-shaped-subhead-lattice`, `cross-engine-intermediary`, and
`inverted-retrieval-target` — and produces paste-ready artifacts.

Measurement leaves the plugin. Users self-report engine observations
(ChatGPT, Perplexity, Google AIO, Claude.ai, Gemini) on a Supabase-
backed dashboard. Every state-machine transition is human-triggered;
the plugin only runs work on transitions.

See [`docs/v0.3.0/`](docs/v0.3.0/) and the v0.3.0 entry in
[CHANGELOG.md](CHANGELOG.md) for the full reorientation. The
[`/aeo:*`](#components) commands and `v0.2.0` flow are untouched.

## North-star contradictions (TRIZ frame)

- **v0.2.0 — Measure vs. Act.** Every incumbent improves *measurement*
  of AI citation share at the cost of human effort to *act*. The Ideal
  Final Result is a system in which measurement and intervention are
  the same loop — the act of measuring closes the gap.
- **v0.3.0 — Pull without authority real estate.** Standard SEO/AEO
  tactics (schema, citations, headings, FAQ) are still in the toolkit,
  but they're now means, not ends. The end is *citation-pull from any
  substrate*, including substrates the user does not own at the URL
  level (Substack, YouTube). Resolved via the five-charter set above.

## Components

| Surface | Purpose | Status |
|---|---|---|
| **Dual-target plugin** (`plugin/`) | Same source tree, two manifests (`.cursor-plugin/plugin.json` for Cursor, `.claude-plugin/plugin.json` for Claude Code CLI). v0.2.0 commands `/aeo:bootstrap`, `/aeo:loop`, `/aeo:audit`, `/aeo:track`, `/aeo:fix`, `/aeo:results`, `/aeo:compete`. v0.3.0 commands `/pull:recommend`, `/pull:apply`, `/pull:measure`, `/pull:analyze`, `/pull:state`. Agents: `aeo-loop` (v0.2.0), `pull-orchestrator` (v0.3.0). Hooks: `SessionStart` (Sākṣī witness), `PreToolUse` (claude-CLI guard), `Stop` (compaction nudge). | **v0.3.0** |
| **MCP server** (`mcp/`) | 21 JSON-RPC tools at `POST http://127.0.0.1:7301/rpc` — 16 v0.2.0 (audit/brief/citation/PR side) + 5 v0.3.0 (`pull_recommend`, `pull_apply_artifact`, `pull_analyze`, `read_use_case_state`, `record_use_case_event`). `track_citations` and `read_citation_trend` return v0.3.0 deprecation envelopes. Token-bucket rate limiting, fail-open Claude fallbacks, full HTTP integration test in CI. | **v0.3.0** |
| **Pratyakṣa epistemology gate** (vendored at `tools/pratyaksha/`) | Witness invariants (Sākṣī), conflict detection, sublation-with-evidence. Wired into the AEO loop runner as the Manas/Buddhi pair: Manas drafts the brief, Buddhi consults Pratyakṣa before the PR opens. Adoption rationale in `docs/decisions/2026-04-26-pratyaksha-integration.md`. | **v0.2.0** |
| **Claude Code skills** (`skills/`) | `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel` | v0.2.0 |
| **Next.js web dashboard** (`apps/web`) | Multi-user, Supabase-backed (Auth + Postgres + RLS). v0.3.0 routes: `/login`, `/dashboard`, `/use-cases/new`, `/use-cases/[id]`, `/use-cases/[id]/measurements/new`. v0.2.0 sites/PRs routes archived but still mounted. Orchestrates the Claude Code CLI worker via MCP HTTP bridge (`POST /rpc` on `:7301`) and WebSocket. | **v0.3.0** |
| **CLI worker daemon** (`packages/cli-worker`) | Drives the Claude Code CLI subprocess; persistent JSONL job queue; rate-limits to subscription quotas; streams events to the web app over WebSocket; honours `payload.dry_run` for safe end-to-end smokes | v0.2.0 |

## Repository layout

```
llm-seo-lab/
├── docs/
│   ├── research/       # Research expansions, competitor matrix, citation mechanism studies
│   ├── triz/           # Contradiction cards, ARIZ session logs, principle applications
│   ├── spec/           # Design spec for plugin/MCP/skills/app
│   ├── prd/            # Product requirements + pricing
│   ├── plans/          # Implementation plan (TDD, bite-sized tasks)
│   ├── benchmarks/     # Methodology + statistical analysis vs SOTA
│   ├── use-cases/      # Real-site validation reports
│   └── whitepaper/     # Substack-publishable long-form
├── plugin/             # Cursor plugin (commands + agents)
├── mcp/                # MCP server (Python/FastMCP)
├── skills/             # Claude Code skills bundle
├── apps/web/           # Next.js dashboard
├── packages/
│   ├── cli-worker/     # Claude Code CLI orchestration daemon
│   └── shared/         # Shared types, utilities
├── benchmarks/         # Benchmark harness scripts
├── tools/              # Vendored tooling (e.g. attractor-flow submodule)
└── .github/workflows/  # CI
```

## Methodology

The product is not designed by intuition. The design pipeline is:

1. **Research expansion** — extend the existing competitive landscape research with deep-dives into citation mechanisms and the GEO evidence base.
2. **TRIZ contradiction mapping** — formalize the five candidate contradictions, run the matrix, formulate Ideal Final Results, deepen with ARIZ-85C on the top-1.
3. **Solution generation** — TRIZ-led divergence (6–8 sketches scored on the 4×25 rubric) followed by attractor-flow convergence (basin depth + Lyapunov + perturbation) to two finalists.
4. **Spec → PRD → Plan** — gated documentation written before any product code.
5. **Build** — TDD, subagent-driven implementation across worktrees.
6. **Statistical benchmarking** — power analysis, two-proportion z-tests, Bonferroni correction, bootstrap CIs, against the SOTA tools.
7. **Real-site proof** — pre/post measurement on `technektar.dev`, `technektar.substack.com`, a SharathSPhD GitHub Pages site, and two additional indie sites.

A research-grade whitepaper is published to [technektar.substack.com](https://technektar.substack.com) at the end of phase 7.

## Why TRIZ + attractor-flow

TRIZ forces the design space wide open by making the engineer state and resolve formal contradictions instead of jumping to compromise. Attractor-flow then steers the multi-agent build trajectory using dynamical-systems signals (Lyapunov exponents, regime classification) so we converge on a stable solution without thrashing. Together they give you both ceiling (radical creativity) and floor (mechanical convergence).

## Quickstart

> **Prerequisites:** Node ≥ 20.10, the [Claude Code CLI](https://docs.anthropic.com/claude-code/quickstart) on `PATH` (subscription, not API), the [`gh` CLI](https://cli.github.com/) authenticated against the customer repo, and (recommended) [`uv`](https://docs.astral.sh/uv/) so the Pratyakṣa Buddhi gate can come online. Without `uv` the loop still runs — it falls back to a permissive no-op gate.

```bash
git clone --recurse-submodules https://github.com/SharathSPhD/llm-seo-lab.git
cd llm-seo-lab
./scripts/install.sh
```

The installer verifies your toolchain, installs npm workspaces, initialises the `attractor-flow` and `pratyaksha` submodules, and prints the next steps. The MCP server is TypeScript; there is no Python install step under `mcp/` (an earlier version of the script attempted `uv pip install` there — that was an architecture-review finding and has been removed).

### Install the Cursor / Claude Code plugin (in this repo)

```bash
# From inside Claude Code:
/plugin marketplace add /absolute/path/to/llm-seo-lab
/plugin install llm-seo-lab@llm-seo-lab
# Verify:
/aeo:status
```

The same source tree under `plugin/` ships both manifests (`.cursor-plugin/plugin.json` and `.claude-plugin/plugin.json`).

### Run the closed loop

```bash
# 1. Start the MCP server on :7301
node --experimental-strip-types --no-warnings \
  mcp/bin/llm-seo-lab-mcp.mjs --port=7301 --data-dir="$(pwd)/data"

# 2. Smoke the loop without opening a PR (Sākṣī + Manas + Buddhi all live):
node --experimental-strip-types --no-warnings \
  scripts/aeo-live-run.mjs --site sharathsphd-githubio --dry-run

# 3. Real run that opens a PR against the configured customer repo:
node --experimental-strip-types --no-warnings \
  scripts/aeo-live-run.mjs --site sharathsphd-githubio
```

The first real run on `sharathsphd.github.io` is captured under
[`docs/use-cases/P3-live-run-2026-04-25/`](docs/use-cases/P3-live-run-2026-04-25/README.md)
with the resulting PR at
<https://github.com/SharathSPhD/SharathSPhD.github.io/pull/1>.

### Run the v0.3.0 citation-pull dashboard

> **Additional prerequisites:** a [Supabase](https://supabase.com)
> project (free tier works). Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
> and (optionally for service-role admin paths) `SUPABASE_SERVICE_ROLE_KEY`
> in `apps/web/.env.local`. Set `LLM_SEO_LAB_AUTH=supabase` to switch
> off the local-dev shim.

```bash
# 1. Apply the v0.3.0 schema + RLS to your Supabase project:
supabase db push --file infra/supabase/migrations/0001_init.sql
# (or paste the file in the Supabase SQL editor)

# 2. Start the MCP server on :7301 (same as v0.2.0).
node --experimental-strip-types --no-warnings \
  mcp/bin/llm-seo-lab-mcp.mjs --port=7301 --data-dir="$(pwd)/data"

# 3. Start the dashboard.
LLM_SEO_LAB_AUTH=supabase npm run dev --workspace=@llm-seo-lab/web
# Sign in via magic link at http://localhost:3030/login

# 4. (Optional) Seed the three real v0.3.0 use cases as JSONL mirror.
node scripts/seed-use-cases.mjs
```

The three seeded use cases (`u1-technektar-dev`,
`u2-technektar-substack-context-window`, `u3-youtube-fM2hpqPx8zg`) are
described in `data/use-cases/<id>/config.json` with the matching
deterministic event log at `data/use-cases/<id>/state.jsonl`. `u2`
(Substack) is the canonical end-to-end exemplar — it walks through
`DRAFT → RECOMMENDED → APPLIED → REPUBLISHED → MEASURING → MEASURED →
ANALYZED` with three engine observations (ChatGPT, Perplexity, Google
AIO) and a non-stub analysis verdict.

From inside Claude Code, the v0.3.0 commands compose as:

```text
/pull:recommend  use_case_id=u2-technektar-substack-context-window
/pull:apply      use_case_id=u2-technektar-substack-context-window rec_id=...
# (you copy the artifact, edit the post, republish, click 'Mark
# applied' and 'Republished' on the dashboard)
/pull:measure    use_case_id=u2-technektar-substack-context-window
# (you observe ChatGPT/Perplexity/Google AIO yourself and report on
# /use-cases/<id>/measurements/new)
/pull:analyze    use_case_id=u2-technektar-substack-context-window
/pull:state      use_case_id=u2-technektar-substack-context-window
```

The dashboard does **not** crawl any AI engine and does **not**
auto-publish to Substack or YouTube. It is the ledger; the human is
the actor.

### Default ports

| Service | Default | Override |
|---|---|---|
| Next.js dashboard | `3030` | `next dev --port` |
| cli-worker HTTP `/health` | `7303` | `--http-port` |
| cli-worker WebSocket | `7302` | `--ws-port` |
| MCP server (`POST /rpc`) | `7301` | `LLM_SEO_LAB_MCP_URL` |
| Pratyakṣa MCP (stdio via `uv run`) | n/a | bundled with the loop runner |

### Useful scripts

```bash
npm run typecheck            # tsc --noEmit across all workspaces
npm run test                 # node --test in every workspace; pytest in mcp/
npm run lint                 # eslint
npm run format               # prettier --write
npm run build                # next build for apps/web; tsc for packages
npm run smoke                # daemon e2e smoke test
npm run test:benchmarks      # Phase 6 statistics + question-bank + runner unit tests
npm run test:benchmarks:run  # full Phase 6 simulation -> benchmarks/runs/local/results.md
```

## Phase 6 — statistical benchmarking

The benchmarking harness is fully described in
[`docs/benchmarks/methodology.md`](docs/benchmarks/methodology.md), which is the
**pre-registration** of the experiment (frozen before any results were
collected). The pre-reg covers the hypothesis statements, the deterministic
1500-question bank, the five-engine cohort, the four treatments, the power
calculation that fixed N=1500, and the Bonferroni-corrected analysis plan.

`benchmarks/` ships:

- `analysis/power.py` — pure-Python sample-size calculator (no SciPy dependency)
- `analysis/stats.py` — pooled two-proportion z-test, Bonferroni, Cohen's h,
  bootstrap CIs, McNemar's test
- `questions/bank.py` — deterministic 1500-question bank (50 topics × 10
  templates × 4 categories) seeded from `questions/seeds.json`
- `engines/simulation.py` — Bernoulli-draw simulators for Perplexity, ChatGPT,
  Google AIO, Gemini, Claude.ai with calibration documented in source
- `treatments/registry.py` — the four treatment labels declared in §5
- `runner/orchestrator.py` — walks the (engine × treatment × site × question)
  grid in canonical order and writes byte-stable JSONL events
- `analysis/renderer.py` — turns the JSONL into a `results.md` with the
  full pre-registered analysis (headline contrast + Bonferroni + bootstrap CI
  + Cohen's h + McNemar paired-test robustness check + secondary contrasts)

Run the simulation harness end-to-end (≈3 s, 180 000 Bernoulli draws):

```bash
npm run test:benchmarks:run
open benchmarks/runs/local/results.md
```

The simulation calibrates `llm_seo_lab` to a +5–7pp uplift per engine vs
`baseline` (the [seo_research_2.md](docs/research/seo_research_2.md) survey
midpoint) so the harness can validate the entire pipeline — including the
statistical rejection logic — without touching real engines. Phase 7 swaps in
real Playwright + Claude CLI adapters behind the same `Engine` protocol.

## Development workflow

The agent-driven development workflow is documented in [CLAUDE.md](CLAUDE.md). The repo's `.mcp.json` registers the **attractor-flow** and **triz-engine** MCP servers so the design loop (TRIZ contradiction analysis → attractor-flow convergence) runs inside Cursor.

Phase progress and history are tracked in [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
