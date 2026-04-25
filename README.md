# llm-seo-lab

> Path-breaking AEO / LLM-SEO platform. Closed-loop autonomous citation engineering powered by the Claude Code CLI subscription (no per-token API), TRIZ-driven design, and attractor-flow orchestration.

## What this is

The AEO / GEO / LLM-SEO category in 2026 is dominated by **monitoring dashboards** (AthenaHQ, Profound, Otterly.AI, Peec.ai, Geol.ai, Goodie, Search Party, SerpAPI). They surface visibility gaps but they do not close them. `llm-seo-lab` exists to close that loop: detect the gap, generate the fix, publish the artifact, verify the citation lift.

## North-star contradiction (TRIZ frame)

**Measure vs. Act.** Every incumbent improves *measurement* of AI citation share at the cost of human effort to *act*. The Ideal Final Result is a system in which measurement and intervention are the same loop — the act of measuring closes the gap.

## Components

| Surface | Purpose | Status |
|---|---|---|
| **Cursor plugin** (`plugin/`) + `aeo-loop` agent | Developer-facing AEO workflows inside Cursor: `/aeo:bootstrap`, `/aeo:loop`, `/aeo:audit`, `/aeo:track`, `/aeo:fix`, `/aeo:results`, `/aeo:compete` | v0.1.0-alpha |
| **MCP server** (`mcp/`) | 12 tools (`audit_page`, `track_citations`, `generate_brief`, `emit_schema`, `compare_competitors`, `oracle_query`, …) + 3 widgets, exposed over JSON-RPC to any MCP client | v0.1.0-alpha |
| **Claude Code skills** (`skills/`) | `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel` | v0.1.0-alpha |
| **Next.js web dashboard** (`apps/web`) | Consumer-facing surface; orchestrates the Claude Code CLI worker via the MCP HTTP bridge and a WebSocket | v0.1.0-alpha |
| **CLI worker daemon** (`packages/cli-worker`) | Drives the Claude Code CLI subprocess; queues; rate-limits to subscription quotas; streams events to the web app over WebSocket | v0.1.0-alpha |

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

> **Prerequisites:** Node ≥ 20.10, Python ≥ 3.11, the [Claude Code CLI](https://docs.anthropic.com/claude-code/quickstart) on `PATH`, and (recommended) [`uv`](https://docs.astral.sh/uv/) for the Python MCP server.

```bash
git clone https://github.com/SharathSPhD/llm-seo-lab.git
cd llm-seo-lab
./scripts/install.sh
```

The installer verifies your toolchain, installs npm workspaces, syncs Python dependencies for the MCP server, and prints the next steps. Then:

```bash
# 1. Start the cli-worker daemon (job queue, WebSocket, /health)
npm run start --workspace=@llm-seo-lab/cli-worker

# 2. In another shell, start the Next.js dashboard
npm run dev --workspace=@llm-seo-lab/web
open http://localhost:3030

# 3. In your target site's repo, open Cursor and run
#    /aeo:bootstrap   # writes .llm-seo-lab/config.yaml
#    /aeo:loop        # one full audit → brief → PR cycle

# 4. Verify the daemon is up
curl -s http://localhost:7303/health | jq .
```

End-to-end smoke test (boots the daemon on ephemeral ports, hits `/health`, completes a WebSocket handshake, sends `SIGTERM`, asserts a clean exit):

```bash
npm run smoke
```

### Default ports

| Service | Default | Override |
|---|---|---|
| Next.js dashboard | `3030` | `next dev --port` |
| cli-worker HTTP `/health` | `7303` | `--http-port` |
| cli-worker WebSocket | `7302` | `--ws-port` |
| MCP server (HTTP bridge) | `7301` | `LLM_SEO_LAB_MCP_URL` |

### Useful scripts

```bash
npm run typecheck   # tsc --noEmit across all workspaces
npm run test        # node --test in every workspace; pytest in mcp/
npm run lint        # eslint
npm run format      # prettier --write
npm run build       # next build for apps/web; tsc for packages
npm run smoke       # daemon e2e smoke test
```

## Development workflow

The agent-driven development workflow is documented in [CLAUDE.md](CLAUDE.md). The repo's `.mcp.json` registers the **attractor-flow** and **triz-engine** MCP servers so the design loop (TRIZ contradiction analysis → attractor-flow convergence) runs inside Cursor.

Phase progress and history are tracked in [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
