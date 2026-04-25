#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
freshness-radar harness.

Asserts that the deterministic radar correctly orders the synthetic decay
fixture: post-a (>20pp decay, >180d old) is urgent; post-b is ok; post-c
is skipped (insufficient history).
"""

from __future__ import annotations
import json
import sys
from datetime import datetime, date
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 4, 25)


def parse_date(s: str) -> date:
    return datetime.fromisoformat(s).date()


def stub_radar(pages: list[dict]) -> list[dict]:
    out = []
    for p in pages:
        hist = p.get("citation_history", [])
        if len(hist) < 2:
            continue
        decay = hist[0]["share"] - hist[-1]["share"]
        days = (TODAY - parse_date(p["last_updated"])).days
        if decay > 0.10 or days > 180:
            pri = "urgent"
        elif decay > 0.05 or days > 90:
            pri = "soon"
        elif decay > 0.02 or days > 30:
            pri = "monitor"
        else:
            pri = "ok"
        out.append({
            "page_url": p["page_url"],
            "decay_pp": round(decay * 100, 2),
            "days_since_update": days,
            "refresh_priority": pri,
        })
    severity = {"urgent": 3, "soon": 2, "monitor": 1, "ok": 0}
    out.sort(key=lambda r: (-severity[r["refresh_priority"]], -r["decay_pp"], -r["days_since_update"]))
    return out


def main() -> int:
    spec = json.loads((FIX / "decay.json").read_text())
    ranked = stub_radar(spec["pages"])
    fail = 0
    try:
        assert len(ranked) == 2, f"expected 2 ranked pages got {len(ranked)} (post-c should be skipped)"
        assert ranked[0]["page_url"].endswith("post-a")
        assert ranked[0]["refresh_priority"] == "urgent"
        assert ranked[1]["page_url"].endswith("post-b")
        assert ranked[1]["refresh_priority"] == "soon"
        print(f"PASS freshness-radar: {ranked[0]['page_url']}={ranked[0]['refresh_priority']}({ranked[0]['decay_pp']:+}pp), "
              f"{ranked[1]['page_url']}={ranked[1]['refresh_priority']}({ranked[1]['decay_pp']:+}pp)")
    except AssertionError as e:
        fail += 1
        print(f"FAIL freshness-radar: {e}; got: {ranked}")
    return fail


if __name__ == "__main__":
    sys.exit(main())
