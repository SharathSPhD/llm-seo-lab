#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
schema-generator harness.

Validates that the deterministic stub emits valid JSON-LD per fixture
page_type with all required fields per the SKILL.md contract.

Validation is structural (correct @context, @type, required fields). A live
schema.org validator integration is deferred to v0.2 — Tier-2 evidence in
the GEO paper, plus the schema.org validator itself is rate-limited.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"

REQUIRED_FIELDS = {
    "Article": ["headline", "author", "datePublished", "publisher"],
    "FAQPage": ["mainEntity"],
    "HowTo": ["name", "step"],
    "Product": ["name", "description", "brand", "offers"],
    "Person": ["name"],
    "Organization": ["name", "url"],
}


def stub_emit(spec: dict) -> dict:
    pt = spec["page_type"]
    facts = spec["facts"]
    base = {"@context": "https://schema.org", "@type": pt, "url": spec["page_url"]}
    if pt == "Article":
        base.update({
            "headline": spec["page_title"],
            "author": {"@type": "Person", "name": facts["author_name"]},
            "datePublished": facts["date_published"],
            "publisher": {"@type": "Organization", "name": facts["publisher_name"]},
        })
    elif pt == "FAQPage":
        base["mainEntity"] = [
            {"@type": "Question", "name": qa["q"],
             "acceptedAnswer": {"@type": "Answer", "text": qa["a"]}}
            for qa in facts["qas"]
        ]
    elif pt == "HowTo":
        base.update({
            "name": spec["page_title"],
            "step": [{"@type": "HowToStep", "text": s} for s in facts["steps"]],
        })
    elif pt == "Product":
        base.update({
            "name": spec["page_title"],
            "description": facts["description"],
            "brand": {"@type": "Brand", "name": facts["brand_name"]},
            "offers": {"@type": "Offer", "price": facts["price"],
                       "priceCurrency": facts["currency"]},
        })
    return base


def assert_valid(jsonld: dict, page_type: str) -> None:
    assert jsonld.get("@context") == "https://schema.org"
    assert jsonld.get("@type") == page_type
    for field in REQUIRED_FIELDS[page_type]:
        assert field in jsonld, f"missing required {field} for {page_type}"


def main() -> int:
    fixtures = json.loads((FIX / "page-types.json").read_text())["fixtures"]
    fail = 0
    for spec in fixtures:
        emitted = stub_emit(spec)
        try:
            assert_valid(emitted, spec["page_type"])
            print(f"PASS schema {spec['page_type']:<14} keys={sorted(emitted.keys())}")
        except AssertionError as e:
            fail += 1
            print(f"FAIL schema {spec['page_type']}: {e}")
    return fail


if __name__ == "__main__":
    sys.exit(main())
