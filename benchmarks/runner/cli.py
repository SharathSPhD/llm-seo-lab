"""Command-line entry: run the benchmark and render `results.md`.

Usage:
    python3 -m benchmarks.runner.cli [--output-dir DIR] [--seed INT]

Default output is `benchmarks/runs/latest/`.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from benchmarks.analysis import render_results
from benchmarks.runner.orchestrator import RunConfig, run


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="benchmarks.runner")
    parser.add_argument(
        "--output-dir",
        default="benchmarks/runs/latest",
        help="Directory to write events.jsonl + results.md (default: %(default)s)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20260425,
        help="Top-level harness seed (default: %(default)s)",
    )
    args = parser.parse_args(argv)

    out_dir = Path(args.output_dir).resolve()
    events_path = out_dir / "events.jsonl"
    results_path = out_dir / "results.md"

    config = RunConfig(output_path=events_path, seed=args.seed)
    print(f"[runner] writing events to {events_path}", file=sys.stderr)
    run(config)
    print(f"[runner] rendering results to {results_path}", file=sys.stderr)
    render_results(events_path, results_path)
    print(f"[runner] done. results: {results_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
