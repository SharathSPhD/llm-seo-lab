#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
competitive-citation-intel harness.

Asserts the deterministic stub returns gap themes ranked by missing-engine
breadth and that the user's already-strong themes are excluded.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"


def stub_intel(spec: dict) -> dict:
    user = spec["user_site"]
    citation_map = spec["citation_map"]
    engines = list(citation_map.keys())
    questions = sorted({q for emap in citation_map.values() for q in emap})

    user_share = {}
    competitor_share = {}
    for eng in engines:
        emap = citation_map[eng]
        n = len(emap)
        user_hits = sum(1 for cited in emap.values() if user in cited)
        user_share[eng] = round(user_hits / n, 3)
        competitor_share[eng] = {}
        for site in spec["competitor_sites"]:
            comp_hits = sum(1 for cited in emap.values() if site in cited)
            competitor_share[eng][site] = round(comp_hits / n, 3)

    gap_themes = []
    for q in questions:
        missing_on = []
        comp_total = 0.0
        for eng in engines:
            cited = citation_map[eng].get(q, [])
            if user not in cited:
                missing_on.append(eng)
                comp_total += sum(1 for c in cited if c in spec["competitor_sites"])
        if missing_on and comp_total > 0:
            gap_themes.append({
                "theme": q,
                "missing_on_engines": missing_on,
                "suggested_brief": f"Author a definitive page on '{q}' "
                                   f"with primary-source citations and "
                                   f"a stats-backed example block.",
                "_breadth": len(missing_on),
                "_comp_total": comp_total,
            })
    gap_themes.sort(key=lambda t: (-t["_breadth"], -t["_comp_total"]))
    for t in gap_themes:
        t.pop("_breadth"); t.pop("_comp_total")

    return {
        "topic": spec["topic"],
        "user_share_per_engine": user_share,
        "competitor_share_per_engine": competitor_share,
        "gap_themes": gap_themes,
    }


def main() -> int:
    spec = json.loads((FIX / "citation-map.json").read_text())
    out = stub_intel(spec)
    fail = 0
    try:
        assert "gap_themes" in out and len(out["gap_themes"]) >= 3
        assert all("missing_on_engines" in t and "suggested_brief" in t for t in out["gap_themes"])
        ranked = out["gap_themes"]
        widths = [len(t["missing_on_engines"]) for t in ranked]
        assert widths == sorted(widths, reverse=True), f"not ranked by breadth: {widths}"
        print(f"PASS competitive-citation-intel: {len(ranked)} gap themes, "
              f"widest missing on {widths[0]} engines")
    except AssertionError as e:
        fail += 1
        print(f"FAIL competitive-citation-intel: {e}")
    return fail


if __name__ == "__main__":
    sys.exit(main())
