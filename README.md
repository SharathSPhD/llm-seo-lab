# llm-seo-lab

> Path-breaking AEO / LLM-SEO platform. Closed-loop autonomous citation engineering powered by the Claude Code CLI subscription (no per-token API), TRIZ-driven design, and attractor-flow orchestration.

## What this is

The AEO / GEO / LLM-SEO category in 2026 is dominated by **monitoring dashboards** (AthenaHQ, Profound, Otterly.AI, Peec.ai, Geol.ai, Goodie, Search Party, SerpAPI). They surface visibility gaps but they do not close them. `llm-seo-lab` exists to close that loop: detect the gap, generate the fix, publish the artifact, verify the citation lift.

## North-star contradiction (TRIZ frame)

**Measure vs. Act.** Every incumbent improves *measurement* of AI citation share at the cost of human effort to *act*. The Ideal Final Result is a system in which measurement and intervention are the same loop — the act of measuring closes the gap.

## Components

| Surface | Purpose | Status |
|---|---|---|
| **Dual-target plugin** (`plugin/`) | Same source tree, two manifests (`.cursor-plugin/plugin.json` for Cursor, `.claude-plugin/plugin.json` for Claude Code CLI). Commands `/aeo:bootstrap`, `/aeo:loop`, `/aeo:audit`, `/aeo:track`, `/aeo:fix`, `/aeo:results`, `/aeo:compete`. Hooks: `SessionStart` (Sākṣī witness), `PreToolUse` (claude-CLI guard), `Stop` (compaction nudge). | **v0.2.0** |
| **MCP server** (`mcp/`) | 16 JSON-RPC tools at `POST http://127.0.0.1:7301/rpc` — `audit_page`, `track_citations`, `generate_brief`, `emit_schema`, `compare_competitors`, `oracle_query`, `read_config`, `open_pr` (with live clone+commit+push+create mode), `list_sites`, `read_latest_audit`, `list_prs`, `read_citation_trend`, plus 3 widgets. Token-bucket rate limiting, fail-open Claude fallbacks, full HTTP integration test in CI. | **v0.2.0** |
| **Pratyakṣa epistemology gate** (vendored at `tools/pratyaksha/`) | Witness invariants (Sākṣī), conflict detection, sublation-with-evidence. Wired into the AEO loop runner as the Manas/Buddhi pair: Manas drafts the brief, Buddhi consults Pratyakṣa before the PR opens. Adoption rationale in `docs/decisions/2026-04-26-pratyaksha-integration.md`. | **v0.2.0** |
| **Claude Code skills** (`skills/`) | `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel` | v0.2.0 |
| **Next.js web dashboard** (`apps/web`) | Consumer-facing surface; orchestrates the Claude Code CLI worker via the MCP HTTP bridge (`POST /rpc` on `:7301`) and a WebSocket | v0.2.0 |
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
