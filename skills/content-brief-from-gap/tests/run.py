#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
content-brief-from-gap harness.

Asserts the deterministic stub generates one ContentBrief per AuditGap with
the required fields: brief_id, gap_id, page_url, tactic, evidence_tier,
rationale_md, diff_patch, revert_plan_md, measurement_plan, claude_model.
"""

from __future__ import annotations
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"


def stub_brief(gap: dict, page_url: str = "https://example.com/x") -> dict:
    now = datetime.now(timezone.utc).isoformat()
    if gap["tactic"] == "cite_sources":
        diff = (
            "--- a/page.html\n+++ b/page.html\n@@\n-<p>Static sites are fast.</p>\n"
            "+<p>Static sites are fast (per <a href=\"https://web.dev\">web.dev</a>).</p>\n"
        )
    elif gap["tactic"] == "statistics_addition":
        diff = (
            "--- a/page.html\n+++ b/page.html\n@@\n-<p>Most sites benefit.</p>\n"
            "+<p>92% of static sites passed the Core Web Vitals threshold (per HTTP Archive 2025).</p>\n"
        )
    elif gap["tactic"] == "schema_coverage":
        diff = (
            "--- a/page.html\n+++ b/page.html\n@@\n <head>\n+  <script type=\"application/ld+json\">"
            "{\"@context\":\"https://schema.org\",\"@type\":\"Article\"}</script>\n"
        )
    else:
        diff = ""
    return {
        "brief_id": f"brief_{uuid.uuid4().hex[:12]}",
        "gap_id": gap["gap_id"],
        "page_url": page_url,
        "tactic": gap["tactic"],
        "evidence_tier": gap["evidence_tier"],
        "rationale_md": (
            f"Closes gap `{gap['gap_id']}` per **{gap['geo_paper_reference']}**. "
            f"Predicted lift: {gap['predicted_lift_pp']} pp."
        ),
        "diff_patch": diff,
        "revert_plan_md": "Revert with `git revert HEAD` if 14-day post-merge "
                          "delta is < +1pp on any monitored engine.",
        "measurement_plan": {
            "pre_merge_at": now,
            "post_merge_t_plus_1d": None,
            "post_merge_t_plus_7d": None,
            "post_merge_t_plus_14d": None,
        },
        "emitted_schema_blocks": ["Article"] if gap["tactic"] == "schema_coverage" else [],
        "created_at": now,
        "claude_model": "stub-deterministic-v1",
    }


def assert_schema(brief: dict) -> None:
    for k in ("brief_id", "gap_id", "page_url", "tactic", "evidence_tier",
              "rationale_md", "diff_patch", "revert_plan_md", "measurement_plan",
              "created_at", "claude_model"):
        assert k in brief, f"missing field {k}"
    assert brief["evidence_tier"] in ("tier1", "tier2", "tier3")
    assert "pre_merge_at" in brief["measurement_plan"]
    assert brief["measurement_plan"]["post_merge_t_plus_14d"] is None


def main() -> int:
    gaps = json.loads((FIX / "gaps.json").read_text())["gaps"]
    fail = 0
    for gap in gaps:
        brief = stub_brief(gap)
        try:
            assert_schema(brief)
            assert brief["diff_patch"], f"empty diff for {gap['tactic']}"
            print(f"PASS brief gap={gap['gap_id']} tactic={gap['tactic']} diff_lines={brief['diff_patch'].count(chr(10))}")
        except AssertionError as e:
            fail += 1
            print(f"FAIL brief gap={gap['gap_id']}: {e}")
    return fail


if __name__ == "__main__":
    sys.exit(main())
