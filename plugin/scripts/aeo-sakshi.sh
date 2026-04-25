#!/usr/bin/env bash
# aeo-sakshi.sh — SessionStart hook that pins the AEO witness invariant.
#
# Spawns the pratyaksha MCP server (vendored at tools/pratyaksha/mcp/server.py),
# performs the MCP `initialize` handshake, and calls `set_sakshi` with the
# AEO closed-loop invariants. Adopted in R3:
#   docs/decisions/2026-04-26-pratyaksha-integration.md
#
# Fails open per pratyaksha convention — every error path exits 0 so a missing
# uv, missing pratyaksha submodule, or absent MCP framework never blocks the
# session. Diagnostics go to stderr.

set -u

REPO_ROOT="${LLM_SEO_LAB_ROOT:-${PWD}}"
PRATYAKSHA_DIR="${REPO_ROOT}/tools/pratyaksha/mcp"

if [ ! -f "${PRATYAKSHA_DIR}/server.py" ]; then
  printf '[aeo:Sakshi] skipped — pratyaksha submodule not initialised at %s. Run: git submodule update --init tools/pratyaksha\n' \
    "${PRATYAKSHA_DIR}" >&2
  exit 0
fi

if ! command -v uv >/dev/null 2>&1; then
  printf '[aeo:Sakshi] skipped — uv not on PATH. Witness invariant could not be pinned for this session.\n' >&2
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf '[aeo:Sakshi] skipped — python3 not on PATH; cannot drive stdio MCP handshake.\n' >&2
  exit 0
fi

export AEO_SAKSHI_INVARIANT="$(cat <<'SAKSHI'
AEO closed-loop invariants (R3 verdict):
  1. Subscription-only Claude CLI; no API keys, ever.
  2. audit precedes brief; brief precedes PR.
  3. No synthetic citations are ever emitted.
  4. Never overwrite a prior recommendation -- sublate it with evidence.
  5. The witness invariant is itself immune to compaction.
SAKSHI
)"
export AEO_SAKSHI_SERVER="${PRATYAKSHA_DIR}/server.py"

OUTPUT="$(python3 - <<'PY' 2>&1
import json, os, subprocess, sys
from pathlib import Path

server = Path(os.environ["AEO_SAKSHI_SERVER"]).resolve()
inv = os.environ["AEO_SAKSHI_INVARIANT"]
proc = subprocess.Popen(
    ["uv", "run", "--no-project", str(server.name)],
    cwd=str(server.parent),
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True,
)
requests = [
    {"jsonrpc": "2.0", "id": 1, "method": "initialize",
     "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                "clientInfo": {"name": "aeo-sakshi-hook", "version": "0.2.0"}}},
    {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
    {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
     "params": {"name": "set_sakshi", "arguments": {"args": {"content": inv}}}},
]
payload = "\n".join(json.dumps(r) for r in requests) + "\n"
try:
    out, _err = proc.communicate(input=payload, timeout=30)
except subprocess.TimeoutExpired:
    proc.kill()
    print("TIMEOUT")
    sys.exit(0)
print(out)
PY
)"

if printf '%s' "${OUTPUT}" | grep -q 'sakshi_prefix'; then
  printf '[aeo:Sakshi] ready — witness invariant pinned via pratyaksha set_sakshi.\n' >&2
else
  printf '[aeo:Sakshi] soft-failed — pratyaksha did not confirm set_sakshi. Loop will run; sublation gating may degrade to permissive.\n' >&2
fi

exit 0
