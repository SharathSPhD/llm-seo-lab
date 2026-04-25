#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
aeo-audit harness test.

Runs the aeo-audit skill against three fixture pages and asserts the output
schema is well-formed and the scores fall in the expected bands.

Modes:
  - LLM_SEO_LAB_USE_CLAUDE_CLI=1  : shells out to `claude --print` with the
                                     skill prompt and parses the JSON.
  - default                       : uses a deterministic stub scorer based on
                                     HTML feature presence so CI can run
                                     without a Claude CLI subscription.

Schema asserted: matches packages/shared/src/types/audit.ts PageAuditResult.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FIX = Path(__file__).parent / "fixtures"

EXPECTED_BANDS = {
    "strong-page.html": {"min_overall": 70, "max_overall": 100},
    "mixed-page.html": {"min_overall": 20, "max_overall": 75},
    "weak-page.html": {"min_overall": 0, "max_overall": 35},
}


def stub_score(html: str) -> dict:
    """Deterministic feature-based scorer used when Claude CLI is not available."""
    has_jsonld = "application/ld+json" in html
    citation_count = len(re.findall(r"<a [^>]*href=\"https?://", html))
    quote_count = len(re.findall(r"<blockquote", html, re.IGNORECASE))
    stat_count = len(re.findall(r"\d+(?:\.\d+)?\s*%", html))
    hedge_count = len(re.findall(r"\b(might|maybe|perhaps|could be|some people)\b", html, re.IGNORECASE))

    cite_sources = min(100, citation_count * 25)
    quotation_addition = min(100, quote_count * 50)
    statistics_addition = min(100, stat_count * 30)
    authoritative_tone = max(0, 100 - hedge_count * 20)
    schema_coverage = 90 if has_jsonld else 10

    gaps = []
    if cite_sources < 60:
        gaps.append({
            "gap_id": "cite-1",
            "tactic": "cite_sources",
            "predicted_lift_pp": 12,
            "evidence_tier": "tier1",
            "geo_paper_reference": "KDD 2024 GEO §4.2 Cite Sources",
            "page_locator": "article > p",
            "rationale": "Page lacks inline links to primary sources.",
        })
    if quotation_addition < 60:
        gaps.append({
            "gap_id": "quote-1",
            "tactic": "quotation_addition",
            "predicted_lift_pp": 10,
            "evidence_tier": "tier1",
            "geo_paper_reference": "KDD 2024 GEO §4.2 Quotation Addition",
            "page_locator": "article",
            "rationale": "Page lacks attributed expert quotations.",
        })
    if statistics_addition < 60:
        gaps.append({
            "gap_id": "stat-1",
            "tactic": "statistics_addition",
            "predicted_lift_pp": 10,
            "evidence_tier": "tier1",
            "geo_paper_reference": "KDD 2024 GEO §4.2 Statistics Addition",
            "page_locator": "article",
            "rationale": "Page lacks numeric statistics with sources.",
        })
    if schema_coverage < 50:
        gaps.append({
            "gap_id": "schema-1",
            "tactic": "schema_coverage",
            "predicted_lift_pp": 7,
            "evidence_tier": "tier2",
            "geo_paper_reference": "schema.org structured data",
            "page_locator": "head",
            "rationale": "Page emits no JSON-LD.",
        })

    return {
        "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
        "page_url": "file://fixture",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "claude_model": "stub-deterministic-v1",
        "scores": {
            "cite_sources": cite_sources,
            "quotation_addition": quotation_addition,
            "statistics_addition": statistics_addition,
            "authoritative_tone": authoritative_tone,
            "schema_coverage": schema_coverage,
        },
        "gaps": gaps,
    }


def run_via_claude_cli(html: str, page_url: str) -> dict:
    skill_md = (ROOT / "skills" / "aeo-audit" / "SKILL.md").read_text()
    prompt = f"{skill_md}\n\n---\n\nINPUT page_url={page_url}\nINPUT page_html=<<<HTML\n{html}\nHTML"
    proc = subprocess.run(
        ["claude", "--print"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    match = re.search(r"```json\n(.*?)\n```", proc.stdout, re.DOTALL)
    if not match:
        raise RuntimeError(f"Claude CLI did not return a JSON block. stdout: {proc.stdout[:500]}")
    return json.loads(match.group(1))


def run(fixture: str) -> dict:
    html = (FIX / fixture).read_text()
    if os.environ.get("LLM_SEO_LAB_USE_CLAUDE_CLI") == "1":
        return run_via_claude_cli(html, f"file://{fixture}")
    return stub_score(html)


def assert_schema(audit: dict) -> None:
    for key in ("audit_id", "page_url", "timestamp", "claude_model", "scores", "gaps"):
        assert key in audit, f"missing key {key}"
    for axis in ("cite_sources", "quotation_addition", "statistics_addition", "authoritative_tone", "schema_coverage"):
        s = audit["scores"][axis]
        assert isinstance(s, (int, float)), f"score {axis} not numeric: {s}"
        assert 0 <= s <= 100, f"score {axis} out of bounds: {s}"
    for gap in audit["gaps"]:
        for key in ("gap_id", "tactic", "predicted_lift_pp", "evidence_tier", "geo_paper_reference", "page_locator", "rationale"):
            assert key in gap, f"gap missing key {key}: {gap}"
        assert gap["evidence_tier"] in ("tier1", "tier2", "tier3"), gap["evidence_tier"]


def main() -> int:
    fail = 0
    for fixture, band in EXPECTED_BANDS.items():
        try:
            audit = run(fixture)
            assert_schema(audit)
            overall = sum(audit["scores"].values()) / 5
            assert band["min_overall"] <= overall <= band["max_overall"], (
                f"{fixture} overall={overall:.1f} not in [{band['min_overall']}, {band['max_overall']}]"
            )
            print(f"PASS {fixture} overall={overall:.1f} gaps={len(audit['gaps'])}")
        except Exception as e:
            fail += 1
            print(f"FAIL {fixture}: {e}")
    return fail


if __name__ == "__main__":
    sys.exit(main())
