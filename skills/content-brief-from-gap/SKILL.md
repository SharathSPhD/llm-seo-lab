---
name: content-brief-from-gap
version: 0.1.0-alpha.1
description: |
  Convert one AuditGap into a ContentBrief: a unified diff that closes the
  gap, a rationale grounded in the GEO-paper evidence policy, a revert plan,
  and a measurement schedule. Use after `aeo-audit` produces gaps and the
  user wants to draft the actual fix as a reviewable change.
input_schema:
  audit_gap: AuditGap
  page_url: string
  page_html: string
  repo_path: string
output_schema: ContentBrief
---

# content-brief-from-gap

You are converting **one** AuditGap into a fully reviewable ContentBrief.

## Process

1. Load the page HTML.
2. Locate the gap via `audit_gap.page_locator` (CSS selector or line range).
3. Draft the smallest possible HTML/Markdown/JSON-LD edit that closes the
   gap **without changing the page's voice or layout**.
4. Express the edit as a **unified diff patch** suitable for `git apply`.
5. Write a one-paragraph rationale that cites the GEO-paper tier the gap
   maps to (`audit_gap.evidence_tier`).
6. Write a one-sentence revert plan (e.g. `git revert <commit>` or
   "remove the JSON-LD block lines 12-28").
7. Set the measurement schedule:
   - `pre_merge_at` = now
   - `post_merge_t_plus_1d`, `+7d`, `+14d` = null until merged.

## Output

Emit ONE JSON object matching `ContentBrief`. Wrap the JSON in a
` ```json ` fenced block. The unified diff itself goes in `diff_patch` as a
string.

## Stop conditions
- If the gap cannot be closed with a < 50-line edit, set `diff_patch=""`
  and put the reason in `rationale_md`.
- Never propose edits that delete content from the page.
- Never propose edits to `robots.txt` unless the gap is specifically a
  crawler-block gap.
