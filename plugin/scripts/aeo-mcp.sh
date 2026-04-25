#!/usr/bin/env bash
# aeo-mcp.sh — tiny JSON-RPC client for the llm-seo-lab MCP server.
#
# Usage:
#   plugin/scripts/aeo-mcp.sh <tool_name> [json_input]
#
# Examples:
#   plugin/scripts/aeo-mcp.sh list_sites
#   plugin/scripts/aeo-mcp.sh read_config '{"site_id":"sharathsphd-githubio"}'
#   plugin/scripts/aeo-mcp.sh audit_page  '{"page_url":"https://sharathsphd.github.io/"}'
#
# Behaviour:
#   - Talks to ${LLM_SEO_LAB_MCP_URL:-http://127.0.0.1:7301/rpc}.
#   - Unwraps the {ok, value | error} envelope.
#   - Prints `value` on success (pretty-printed if `jq` is available).
#   - Prints the error envelope to stderr and exits non-zero on tool failure.
#
# Designed to be called from plugin commands and agents in both the Cursor and
# Claude Code CLI flavours of llm-seo-lab.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  printf 'usage: %s <tool_name> [json_input]\n' "$0" >&2
  exit 64
fi

tool="$1"
if [ "$#" -ge 2 ] && [ -n "$2" ]; then
  input="$2"
else
  input='{}'
fi

mcp_url="${LLM_SEO_LAB_MCP_URL:-http://127.0.0.1:7301/rpc}"

if ! command -v curl >/dev/null 2>&1; then
  printf 'aeo-mcp: curl is required but missing on PATH\n' >&2
  exit 127
fi

req=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"%s","arguments":%s}}' \
  "${tool}" "${input}")

resp="$(curl -sS -X POST "${mcp_url}" \
  -H 'content-type: application/json' \
  --max-time 60 \
  -d "${req}")"

if command -v jq >/dev/null 2>&1; then
  err_msg="$(printf '%s' "${resp}" | jq -r '.error.message // empty')"
  if [ -n "${err_msg}" ]; then
    printf 'aeo-mcp: jsonrpc error: %s\n' "${err_msg}" >&2
    printf '%s\n' "${resp}" >&2
    exit 1
  fi
  ok="$(printf '%s' "${resp}" | jq -r '.result.ok')"
  if [ "${ok}" = "true" ]; then
    printf '%s' "${resp}" | jq '.result.value'
    exit 0
  fi
  if [ "${ok}" = "false" ]; then
    printf 'aeo-mcp: tool %s returned an error envelope:\n' "${tool}" >&2
    printf '%s' "${resp}" | jq '.result.error' >&2
    exit 2
  fi
  printf '%s' "${resp}" | jq '.result // .'
  exit 0
fi

printf '%s\n' "${resp}"
