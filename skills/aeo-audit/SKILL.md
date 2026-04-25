---
name: aeo-audit
version: 0.1.0-alpha.1
description: |
  Audit a single web page for AEO (Answer Engine Optimization) gaps using the
  GEO-paper Tier-1 evidence policy. Use whenever the user asks to audit a page,
  check AEO/LLM-SEO health, find citation gaps, or score a page for what would
  lift its citation share in ChatGPT / Perplexity / Claude / Gemini / Google AIO.
input_schema:
  page_url:
    type: string
    description: Absolute URL of the page to audit.
  page_html:
    type: string
    description: Raw HTML of the page. If omitted the skill will fetch with firecrawl.
output_schema:
  audit_id: string
  page_url: string
  timestamp: string
  claude_model: string
  scores:
    cite_sources: 0-100
    quotation_addition: 0-100
    statistics_addition: 0-100
    authoritative_tone: 0-100
    schema_coverage: 0-100
  gaps: list[AuditGap]
---

# aeo-audit

You are auditing a single web page for **measurable AEO gaps** under the
GEO-paper evidence policy.

## Inputs you receive
1. The page URL.
2. Either raw HTML (preferred) or permission to fetch via firecrawl.

## What you score (0-100 per axis)

The five axes — and **only** these five — are what move citation share in
LLM-grounded answer engines per the KDD 2024 GEO paper §4.2-4.3:

| axis                 | tier   | what it measures                                                                                                                                       |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cite_sources`       | tier-1 | Does the page cite primary sources with inline links to .gov, .edu, peer-reviewed journals, or first-party documentation?                              |
| `quotation_addition` | tier-1 | Does the page include direct quotes from named experts/sources (with attribution and date)?                                                            |
| `statistics_addition`| tier-1 | Does the page include numeric statistics with sources and dates?                                                                                       |
| `authoritative_tone` | tier-2 | Is the prose declarative + first-person-expert + free of hedging words ("might", "perhaps", "could be") in factual claims?                             |
| `schema_coverage`    | tier-2 | Does the page emit valid JSON-LD for at least one of: Article, FAQPage, HowTo, Product, Person, Organization?                                          |

Do **not** score for keyword density. The GEO paper §4.4 shows keyword stuffing
**hurts** Perplexity citation share by ~10%.

## Output

Emit ONE JSON object matching the output_schema above. For each gap, include:
- `gap_id`: short kebab-case id
- `tactic`: one of `cite_sources | quotation_addition | statistics_addition | authoritative_tone | schema_coverage | internal_link_injection | freshness`
- `predicted_lift_pp`: predicted citation-share lift in percentage points (5-15 typical)
- `evidence_tier`: `tier1 | tier2 | tier3`
- `geo_paper_reference`: e.g. "KDD 2024 GEO §4.2 Cite Sources"
- `page_locator`: CSS selector or line range pointing at the gap
- `rationale`: one sentence explaining why this gap matters

Wrap the JSON in a fenced ` ```json ` block so the harness can extract it.

## Stop conditions
- If you cannot fetch or read the HTML, emit `{"error": "...", "actionable_next_step": "..."}` instead.
- Never invent gaps that you cannot point at with a `page_locator`.
- Never score outside 0-100.
