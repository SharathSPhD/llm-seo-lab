#!/usr/bin/env bash
# install.sh — one-shot installer for the llm-seo-lab monorepo.
#
# What it does:
#   1. Verifies Node >= 20.10
#   2. Installs npm workspaces (mcp, plugin, cli-worker, web, shared)
#   3. Verifies that the Claude Code CLI is on PATH (subscription, not API)
#   4. Verifies that `gh` is on PATH and authenticated (needed for live PRs)
#   5. Verifies that `uv` is on PATH (needed for the optional pratyaksha
#      Python MCP server vendored under tools/pratyaksha)
#   6. Initialises git submodules (attractor-flow, pratyaksha)
#   7. Prints a one-screen "next steps" summary
#
# What it deliberately does NOT do:
#   - It does NOT pip-install anything under mcp/. mcp/ is TypeScript;
#     the previous version of this script ran `uv sync` / `pip install
#     -e .` against mcp/, which silently failed and was flagged in the
#     architecture review.
#   - The pratyaksha Python server is run on demand via `uv run` from
#     `tools/pratyaksha/mcp/server.py`. It bootstraps its own venv per
#     invocation; we just verify uv is available so the AEO loop's
#     Buddhi gate can come online.
#
# Usage: ./scripts/install.sh [--skip-node] [--skip-submodules]

set -euo pipefail

SKIP_NODE=0
SKIP_SUBMODULES=0
for arg in "$@"; do
  case "$arg" in
    --skip-node) SKIP_NODE=1 ;;
    --skip-submodules) SKIP_SUBMODULES=1 ;;
    -h|--help)
      sed -n '2,28p' "$0"
      exit 0
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "==> llm-seo-lab installer"
echo "    repo: $repo_root"
echo

if [[ "$SKIP_NODE" -eq 0 ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node not found on PATH. Install Node >= 20.10." >&2
    exit 1
  fi
  node_version="$(node -v)"
  echo "==> node $node_version"
  if ! node -e "const [maj, min] = process.versions.node.split('.').map(Number); process.exit(maj > 20 || (maj === 20 && min >= 10) ? 0 : 1);"; then
    echo "ERROR: node $node_version is too old; need >= 20.10." >&2
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm not found on PATH." >&2
    exit 1
  fi

  echo "==> installing npm workspaces"
  npm install --no-audit --no-fund
fi

if [[ "$SKIP_SUBMODULES" -eq 0 ]]; then
  echo "==> initialising git submodules (attractor-flow, pratyaksha)"
  git submodule update --init --recursive || \
    echo "WARN: submodule init failed; pratyaksha gating will fall back to noop"
fi

if ! command -v claude >/dev/null 2>&1; then
  echo
  echo "WARN: 'claude' CLI not found on PATH."
  echo "      llm-seo-lab requires the Claude Code CLI subscription."
  echo "      Install: https://docs.anthropic.com/claude-code/quickstart"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo
  echo "WARN: 'gh' CLI not found on PATH."
  echo "      open_pr live mode requires gh to clone, push, and create PRs."
  echo "      Install: https://cli.github.com/manual/installation"
elif ! gh auth status >/dev/null 2>&1; then
  echo
  echo "WARN: 'gh' is installed but not authenticated."
  echo "      Run:  gh auth login    then    gh auth setup-git"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo
  echo "WARN: 'uv' not found on PATH."
  echo "      Without uv, the AEO loop's Pratyakṣa Buddhi gate degrades"
  echo "      to no-op (sublation is permissive)."
  echo "      Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

cat <<'NEXT'

==> install complete

Next steps:

  1. Start the MCP server (tools, audit log) on :7301:
       node --experimental-strip-types --no-warnings \
         mcp/bin/llm-seo-lab-mcp.mjs --port=7301 --data-dir="$(pwd)/data"

  2. (Optional) Start the cli-worker daemon (job queue, /health):
       npm run start --workspace=@llm-seo-lab/cli-worker
       # health probe:
       curl -s http://localhost:7303/health | jq .

  3. (Optional) Start the Next.js dashboard:
       npm run dev --workspace=@llm-seo-lab/web
       open http://localhost:3030

  4. End-to-end smoke (no PR opened):
       node --experimental-strip-types --no-warnings \
         scripts/aeo-live-run.mjs --site sharathsphd-githubio --dry-run

  5. Live run that opens a real PR (replaces sharathsphd-githubio with
     your own configured site_id from data/sites/<site>/config.json):
       node --experimental-strip-types --no-warnings \
         scripts/aeo-live-run.mjs --site sharathsphd-githubio
NEXT
