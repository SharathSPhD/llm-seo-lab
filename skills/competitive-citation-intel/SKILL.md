---
name: competitive-citation-intel
version: 0.1.0-alpha.1
description: |
  Compare which competitor sites get cited for a topic and surface the
  themes the user's site is missing. Use whenever the user asks "which
  competitors are getting cited?", "what are competitors doing better?",
  or "competitive AEO analysis".
input_schema:
  topic: string
  user_site: string
  competitor_sites: list[string]
  citation_map: dict[engine, dict[question, list[cited_url]]]
output_schema:
  topic: string
  user_share_per_engine: dict[engine, float]
  competitor_share_per_engine: dict[engine, dict[site, float]]
  gap_themes: list[{theme: string, missing_on_engines: list[engine], suggested_brief: string}]
---

# competitive-citation-intel

For each engine and each question:
1. Compute user_site share = (questions where user_site cited) / total.
2. Compute competitor_site share for each competitor.
3. Cluster the questions where competitors win and the user loses by topic
   theme (use Claude reasoning).
4. For each theme, propose a one-line content brief that would close the
   gap. Mark which engines that theme is missing from.

Sort `gap_themes` by (number of missing engines desc, total competitor
share for that theme desc).

## Stop conditions
- Skip themes where the user is already winning (≥ 30pp ahead).
- Never suggest copying competitor content verbatim.
- Themes must be actionable as briefs, not generic ("write more about X").
