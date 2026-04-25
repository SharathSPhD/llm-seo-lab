#!/usr/bin/env bash
# aeo-stop-compaction.sh — fail-open Stop hook. Emits a one-line nudge so the
# next turn knows where AEO state lives, what the canonical MCP URL is, and
# that long-running optimisation sessions should consider /compact.
set -u

MCP_URL="${LLM_SEO_LAB_MCP_URL:-http://127.0.0.1:7301/rpc}"
DATA_DIR="${LLM_SEO_LAB_DATA_DIR:-${PWD}/data}"

printf '[aeo:Stop] aeo turn complete. mcp=%s data=%s. If this session has run >20 turns, consider /compact to keep brief drafting accurate.\n' \
  "${MCP_URL}" "${DATA_DIR}" >&2
exit 0
