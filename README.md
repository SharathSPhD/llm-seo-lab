# llm-seo-lab

> Path-breaking AEO / LLM-SEO platform. Closed-loop autonomous citation engineering powered by the Claude Code CLI subscription (no per-token API), TRIZ-driven design, and attractor-flow orchestration.

## What this is

The AEO / GEO / LLM-SEO category in 2026 is dominated by **monitoring dashboards** (AthenaHQ, Profound, Otterly.AI, Peec.ai, Geol.ai, Goodie, Search Party, SerpAPI). They surface visibility gaps but they do not close them. `llm-seo-lab` exists to close that loop: detect the gap, generate the fix, publish the artifact, verify the citation lift.

## North-star contradiction (TRIZ frame)

**Measure vs. Act.** Every incumbent improves *measurement* of AI citation share at the cost of human effort to *act*. The Ideal Final Result is a system in which measurement and intervention are the same loop — the act of measuring closes the gap.

## Components

| Surface | Purpose | Status |
|---|---|---|
| **Cursor plugin** + agents | Developer-facing AEO workflows inside Cursor | spec phase |
| **MCP server** | Reusable AEO tools exposed to any MCP-compatible client | spec phase |
| **Claude Code skills** | `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel` | spec phase |
| **Next.js web dashboard** (`apps/web`) | Consumer-facing surface; orchestrates Claude Code CLI worker | spec phase |
| **CLI worker daemon** (`packages/cli-worker`) | Drives the Claude Code CLI subprocess; queues; rate-limits to subscription quotas; streams to web app | spec phase |

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

## Run

The development workflow is documented in [CLAUDE.md](CLAUDE.md). The `.mcp.json` registers attractor-flow and triz-engine MCP servers for the Claude Code CLI.

## License

MIT — see [LICENSE](LICENSE).
