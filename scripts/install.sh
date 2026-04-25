#!/usr/bin/env bash
# install.sh — one-shot installer for the llm-seo-lab monorepo.
#
# What it does:
#   1. Verifies Node >= 20.10 and Python >= 3.11
#   2. Installs npm workspaces (plugin, cli-worker, web, shared)
#   3. Installs the Python MCP server via uv (or pip fallback)
#   4. Verifies that the Claude Code CLI is on PATH
#   5. Prints a one-screen "next steps" summary
#
# Usage: ./scripts/install.sh [--skip-python] [--skip-node]

set -euo pipefail

SKIP_NODE=0
SKIP_PYTHON=0
for arg in "$@"; do
  case "$arg" in
    --skip-node) SKIP_NODE=1 ;;
    --skip-python) SKIP_PYTHON=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
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

if [[ "$SKIP_PYTHON" -eq 0 ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 not found on PATH. Install Python >= 3.11." >&2
    exit 1
  fi
  py_version="$(python3 -V 2>&1 | awk '{print $2}')"
  echo "==> python3 $py_version"

  if command -v uv >/dev/null 2>&1; then
    echo "==> uv detected; syncing Python deps"
    (cd mcp && uv sync --frozen 2>/dev/null || uv sync)
  else
    echo "==> uv not detected; falling back to pip in mcp/.venv"
    (cd mcp && python3 -m venv .venv && .venv/bin/pip install --quiet -e .)
  fi
fi

if ! command -v claude >/dev/null 2>&1; then
  echo
  echo "WARN: 'claude' CLI not found on PATH."
  echo "      llm-seo-lab requires the Claude Code CLI subscription."
  echo "      Install: https://docs.anthropic.com/claude-code/quickstart"
fi

cat <<'NEXT'

==> install complete

Next steps:

  1. Start the cli-worker daemon (job queue, WebSocket, /health):
       npm run start --workspace=@llm-seo-lab/cli-worker

  2. In another shell, start the Next.js dashboard:
       npm run dev --workspace=@llm-seo-lab/web
       open http://localhost:3030

  3. In your target site's repo, open Cursor and run:
       /aeo:bootstrap
       /aeo:loop

  4. Verify the daemon is up:
       curl -s http://localhost:7303/health | jq .

For end-to-end smoke testing, run:
       npm run smoke
NEXT
