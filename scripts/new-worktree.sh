#!/usr/bin/env bash
# new-worktree.sh — create a sibling worktree for a new phase or build slice.
#
# Usage: scripts/new-worktree.sh <slice-name>
#   e.g. scripts/new-worktree.sh phase5-skills
#
# Creates a sibling directory ../llm-seo-lab-<slice-name> on a new branch
# feature/<slice-name>. Sibling layout (not nested) avoids node_modules,
# .next, and .venv collisions across worktrees.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <slice-name>" >&2
  exit 1
fi

slice="$1"
branch="feature/${slice}"
worktree_dir="../llm-seo-lab-${slice}"

if git show-ref --quiet "refs/heads/${branch}"; then
  echo "Branch ${branch} already exists; using it."
  git worktree add "${worktree_dir}" "${branch}"
else
  git worktree add -b "${branch}" "${worktree_dir}"
fi

echo
echo "Worktree ready at ${worktree_dir} on branch ${branch}."
echo "Submodules need a separate sync inside the worktree:"
echo "  cd ${worktree_dir} && git submodule update --init --recursive"
