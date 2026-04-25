#!/usr/bin/env bash
# aeo-session-start.sh — fail-open SessionStart hook for the llm-seo-lab plugin.
#
# Goals (cheap, never block the session):
#   1. Confirm the Claude Code subscription CLI is on PATH (subscription, not API).
#   2. Confirm the llm-seo-lab MCP server is reachable on the canonical port.
#   3. Print a one-line "AEO session ready" notice for the agent.
#
# This hook prints diagnostics to stderr and always exits 0.

set -u

MCP_URL="${LLM_SEO_LAB_MCP_URL:-http://127.0.0.1:7301/rpc}"

claude_path="$(command -v claude || true)"
claude_status="missing"
if [ -n "${claude_path}" ]; then
  if "${claude_path}" --version >/dev/null 2>&1; then
    claude_status="ok"
  else
    claude_status="present-but-failing"
  fi
fi

if command -v curl >/dev/null 2>&1; then
  mcp_status_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'content-type: application/json' \
    --max-time 2 \
    -X POST "${MCP_URL}" \
    -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' || echo "000")"
else
  mcp_status_code="no-curl"
fi

if [ "${claude_status}" = "ok" ] && [ "${mcp_status_code}" = "200" ]; then
  printf '[aeo:SessionStart] ready — claude=%s mcp=%s\n' "${claude_path}" "${MCP_URL}" >&2
else
  printf '[aeo:SessionStart] degraded — claude=%s (%s), mcp=%s (%s). Loop will run, but commands needing the MCP server may fail until it is up.\n' \
    "${claude_path:-not-found}" "${claude_status}" "${MCP_URL}" "${mcp_status_code}" >&2
fi

exit 0
