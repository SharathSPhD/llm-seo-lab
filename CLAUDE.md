# CLAUDE.md — Project context for llm-seo-lab

## What this project is

Path-breaking AEO/LLM-SEO platform. Closed-loop autonomous citation engineering powered by the Claude Code CLI subscription (no per-token API). Cursor plugin + MCP server + Claude Code skills + Next.js web dashboard, all under one monorepo. Read [README.md](README.md) and [docs/research/seo_research_1.md](docs/research/seo_research_1.md) for orientation.

## Hard constraints (do not violate)

1. **Claude Code CLI subscription only.** No Claude API keys. No per-token API calls. The `cli-worker` daemon orchestrates `claude` subprocesses and respects subscription quotas.
2. **No additional contributors or emails on commits.** Default git config is correct; do not add `Co-authored-by` trailers, do not modify `user.email`.
3. **Spec → PRD → Plan precede code.** Phases 4 documents are pre-implementation gates. Phase 5 build does not start until those documents are user-approved.
4. **`/ralph-loop` per phase.** Every phase ends with a ralph-loop completeness gate. Do not skip.
5. **Document depth: research-grade.** Every research / spec / benchmark doc is citation-footnoted, has mermaid diagrams where structural, and is publication-ready.

## Methodology — TRIZ + attractor-flow

- Use the **TRIZ engine MCP** for `list_parameters`, `lookup_matrix`, `get_separation_principles`, `get_principle`, `score_solution`, `log_session_entry`. Slash commands: `/principles`, `/matrix`, `/ifr`, `/analyze`, `/ariz`.
- Use the **attractor-flow MCP** for `attractorflow_record_state`, `attractorflow_get_regime`, `attractorflow_get_lyapunov`, `attractorflow_get_basin_depth`, `attractorflow_inject_perturbation`, `attractorflow_detect_bifurcation`, `attractorflow_checkpoint`, `attractorflow_get_trajectory`. Slash commands: `/attractor-status`, `/phase-portrait`.
- TRIZ for **divergence** (force open the design space). Attractor-flow for **convergence** (steer to a stable basin).

## Real-site validation targets (Phase 7)

- [technektar.dev](https://technektar.dev)
- [technektar.substack.com](https://technektar.substack.com)
- A SharathSPhD GitHub Pages site (URL to confirm)
- Two additional indie sites proposed at start of phase 7

## Worktree pattern

```bash
git worktree add ../llm-seo-lab-phase<N>-<name> feature/phase<N>-<name>
```

Worktrees live at sibling paths (not nested), so `cli-worker` and `apps/web` builds in different worktrees do not collide.

## Plugin install state

- **TRIZ engine plugin**: installed in this Cursor workspace, MCP active.
- **attractor-flow plugin**: vendored as `tools/attractor-flow/` (git submodule). Registered for the Claude Code CLI via `.mcp.json`. May also be enabled in Cursor via the `/reload-plugins` slash command.

## Where to find things

- Existing landscape research: `docs/research/seo_research_1.md`
- Master plan (do not edit): `~/.cursor/plans/llm-seo-lab_pathbreaking_aeo_platform_*.plan.md`
- TRIZ session logs: `docs/triz/`
- Spec / PRD / Implementation plan (Phase 4 outputs): `docs/spec/`, `docs/prd/`, `docs/plans/`
- Statistical benchmark methodology + results: `docs/benchmarks/`
- Real-site case studies: `docs/use-cases/`
- Substack-publishable whitepaper: `docs/whitepaper/`
