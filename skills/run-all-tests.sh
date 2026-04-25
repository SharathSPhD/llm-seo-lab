#!/bin/bash
# Run all skill harness tests; exit non-zero on any failure.
set -e
cd "$(dirname "$0")/.."

fail=0
for s in aeo-audit citation-oracle-loop content-brief-from-gap schema-generator freshness-radar competitive-citation-intel; do
  echo "=== $s ==="
  if ! uv run --no-project --script "skills/$s/tests/run.py"; then
    fail=$((fail+1))
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "$fail skill harness(es) failed"
  exit 1
fi
echo "all skill harnesses passed"
