#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
citation-oracle-loop harness.

Loads a question-bank fixture and asserts that the stub oracle returns one
flag per (engine, question) with a graceful fallback set when the engine is
not callable from this environment.

CitationFlag schema mirrors packages/shared/src/types/citation.ts.
"""

from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"


def stub_oracle(spec: dict) -> dict:
    samples = []
    now = datetime.now(timezone.utc).isoformat()
    for engine in spec["engines"]:
        for q in spec["question_bank"]:
            cited = (engine == "claude_ai" and "AEO" in q)
            samples.append({
                "engine": engine,
                "question": q,
                "cited": cited,
                "cited_url": spec["site_url"] if cited else None,
                "cited_snippet": "stub-deterministic" if cited else "fallback: stub mode, no live sample",
                "sampled_at": now,
                "sampling_path": "claude_cli",
            })
    per_engine = {}
    for engine in spec["engines"]:
        eng_samples = [s for s in samples if s["engine"] == engine]
        n = len(eng_samples)
        c = sum(1 for s in eng_samples if s["cited"])
        per_engine[engine] = {"share": (c / n) if n else 0.0, "n_questions": n, "n_citations": c}
    return {
        "topic": spec["topic"],
        "window_start": now,
        "window_end": now,
        "per_engine": per_engine,
        "samples": samples,
    }


def assert_schema(out: dict, spec: dict) -> None:
    assert out["topic"] == spec["topic"]
    n_q = len(spec["question_bank"])
    n_e = len(spec["engines"])
    assert len(out["samples"]) == n_q * n_e, f"expected {n_q*n_e} samples got {len(out['samples'])}"
    for engine in spec["engines"]:
        assert engine in out["per_engine"], f"missing engine {engine}"
        assert out["per_engine"][engine]["n_questions"] == n_q
    for s in out["samples"]:
        assert s["engine"] in spec["engines"]
        assert s["sampling_path"] in ("claude_cli", "playwright", "screenshot")
        assert isinstance(s["cited"], bool)


def main() -> int:
    spec = json.loads((FIX / "static-site-seo.json").read_text())
    out = stub_oracle(spec)
    try:
        assert_schema(out, spec)
        print(f"PASS citation-oracle-loop: {len(out['samples'])} samples, "
              f"{sum(1 for s in out['samples'] if s['cited'])} cited across "
              f"{len(out['per_engine'])} engines")
        return 0
    except AssertionError as e:
        print(f"FAIL citation-oracle-loop: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
