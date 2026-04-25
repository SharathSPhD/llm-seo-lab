#!/usr/bin/env bash
# aeo-pretooluse-claude.sh — fail-open PreToolUse hook for any Bash invocation
# of the Claude CLI. Asserts that the binary is the subscription CLI, not an
# API shim. We refuse to gate the call (return non-zero) — a misconfigured
# environment must not silently swap the binary, but it must not block the
# user either. We log a loud warning and proceed.

set -u

claude_path="$(command -v claude || true)"
if [ -z "${claude_path}" ]; then
  printf '[aeo:PreToolUse] WARN claude CLI not on PATH; skipping subscription check.\n' >&2
  exit 0
fi

ver="$("${claude_path}" --version 2>/dev/null || true)"
if [ -z "${ver}" ]; then
  printf '[aeo:PreToolUse] WARN %s --version failed; cannot verify subscription binary.\n' "${claude_path}" >&2
  exit 0
fi

if printf '%s' "${ver}" | grep -qiE 'claude code'; then
  exit 0
fi

printf '[aeo:PreToolUse] WARN %s reported version %q; expected the Claude Code subscription CLI.\n' "${claude_path}" "${ver}" >&2
exit 0
