---
name: freshness-radar
version: 0.1.0-alpha.1
description: |
  Identify and rank pages by citation-share decay risk. Pages whose
  citation share has dropped > 5pp in the last 30 days, or whose
  last-updated date is > 90 days, are flagged as needing refresh. Use
  whenever the user asks "which pages are losing visibility?" or "what's
  decaying?".
input_schema:
  pages: list[{page_url: string, last_updated: string, citation_history: list[{date, share}]}]
output_schema:
  ranked: list[{page_url, decay_pp, days_since_update, refresh_priority}]
---

# freshness-radar

For each page:
1. Compute `decay_pp` = `share_30d_ago - share_today` (positive = decay).
2. Compute `days_since_update` = `today - last_updated`.
3. Compute `refresh_priority` ∈ {urgent, soon, monitor, ok}:
   - urgent: decay_pp > 10 OR days_since_update > 180
   - soon:   decay_pp > 5  OR days_since_update > 90
   - monitor: decay_pp > 2 OR days_since_update > 30
   - ok: otherwise

Rank pages descending by (refresh_priority severity, decay_pp,
days_since_update).

## Stop conditions
- A page with no citation_history is skipped (cannot compute decay).
- Never flag pages newer than 14 days as urgent (too noisy).
