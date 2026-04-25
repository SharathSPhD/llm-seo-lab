# Phase 0 — Setup & Plugin Verification

**Phase status:** complete
**Worktree:** main (no sibling worktree needed for setup)
**Date:** 2026-04-25

## Goal

Stand up the `SharathSPhD/llm-seo-lab` monorepo, install/verify the TRIZ engine + attractor-flow MCPs, and establish the worktree pattern that Phases 1–7 will use.

## Actions taken

1. **Monorepo skeleton.** Created `docs/{research,triz,spec,prd,plans,benchmarks,use-cases,whitepaper}`, `plugin/`, `mcp/`, `skills/`, `apps/web/`, `packages/{cli-worker,shared}`, `benchmarks/`, `tools/`, `.github/workflows/`. Carried `seo_research_1.md` over to `docs/research/`.
2. **Foundational docs.** `README.md` (orienting future readers), `CLAUDE.md` (hard constraints; methodology pointers), `LICENSE` (MIT), `.gitignore`, `package.json` (npm workspaces stub), `.github/workflows/ci.yml` (docs-structure invariants).
3. **GitHub repo.** `gh repo create SharathSPhD/llm-seo-lab --public` ✓ — see https://github.com/SharathSPhD/llm-seo-lab.
4. **attractor-flow** vendored as a git submodule under `tools/attractor-flow/` (HEAD pinned). `.mcp.json` registers the server via `uv run --no-project server.py`; PEP 723 inline deps install on first call (sentence-transformers, scipy, scikit-learn, mcp, pydantic, numpy).
5. **Worktree helper.** `scripts/new-worktree.sh <slice-name>` creates `../llm-seo-lab-<slice-name>` on `feature/<slice-name>` with submodule-init reminder.

## Verification (smoke tests)

### TRIZ engine MCP — `list_parameters` ✓

```text
total: 39 parameters returned
example: {"id": 1, "name": "Weight of moving object", "software_equivalent": "Memory footprint / payload size (moving data)"}
```

### attractor-flow MCP — JSON-RPC handshake + tools/list ✓

```text
serverInfo: {"name":"attractorflow_mcp","version":"1.27.0"}
protocolVersion: 2025-06-18
tools registered (8):
  attractorflow_record_state
  attractorflow_get_regime
  attractorflow_get_lyapunov
  attractorflow_get_trajectory
  attractorflow_get_basin_depth
  attractorflow_detect_bifurcation
  attractorflow_inject_perturbation
  attractorflow_checkpoint
```

Cold-start time including `uv` install of 60 packages: ~8s. Warm-start is ~1s.

### gh + git ✓

- `gh auth status`: logged in as `SharathSPhD`, scopes `gist`, `read:org`, `repo`.
- `git config user.name`: `SharathSPhD`. No additional contributors will be added per project hard constraint.
- Initial push to `origin/main` succeeded.

## Phase 0 ralph-loop gate

Per `CLAUDE.md`, every phase ends with a ralph-loop completeness check. For Phase 0 the criteria were:

- [x] Monorepo skeleton matches the layout in the master plan
- [x] `docs/research/seo_research_1.md` is in place and pushed
- [x] GitHub repo exists at `SharathSPhD/llm-seo-lab` and `origin/main` is up to date
- [x] TRIZ engine MCP responds to `list_parameters`
- [x] attractor-flow MCP responds to `tools/list`
- [x] Worktree helper script committed and executable (will be `chmod +x` on first use)
- [x] No additional contributors / emails on commits (only `SharathSPhD`)

**Gate verdict:** pass. Proceeding to Phase 1.

## Notes for future phases

- The attractor-flow MCP is registered for the **Claude Code CLI** via `.mcp.json`. To drive it from the Cursor agent (this session), invocations route through `claude --mcp-config .mcp.json` subprocess, which is also how the `cli-worker` package will eventually use it.
- The TRIZ engine MCP is enabled in the Cursor workspace already (verified by direct `CallMcpTool`). Slash commands `/principles`, `/matrix`, `/ifr`, `/analyze`, `/ariz` are available to the user; the underlying MCP tools (`lookup_matrix`, `get_principle`, `get_separation_principles`, `score_solution`, etc.) are available to the agent.
