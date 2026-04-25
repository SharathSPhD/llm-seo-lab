---
name: citation-oracle-loop
version: 0.1.0-alpha.1
description: |
  For each engine in {claude_ai, perplexity, chatgpt, gemini, google_aio}
  and each question in a question bank, sample whether the page in question
  is cited. Use whenever the user asks to "track citations", "sample AI
  visibility", or "check whether a site is cited by ChatGPT/Perplexity".
input_schema:
  site_url: string
  topic: string
  question_bank: list[string]
  engines: list[Engine]
output_schema:
  topic: string
  window_start: string
  window_end: string
  per_engine: dict[Engine, {share, n_questions, n_citations}]
  samples: list[CitationFlag]
---

# citation-oracle-loop

Iterate over each (engine, question) pair. For each pair:

1. **Primary path:** ask Claude (via this CLI) to recall the engine's known
   citation pattern for that question. If Claude has high-confidence
   knowledge, emit a CitationFlag with `sampling_path: "claude_cli"`.
2. **Fallback path:** if low confidence or stale, request the
   `cursor-ide-browser` MCP to open the engine's public UI in the user's
   logged-in browser session, paste the question, and capture which
   sources are cited. Emit `sampling_path: "playwright"`.
3. **Manual path:** if both fail (e.g. screenshot upload by user), the user
   can ingest a screenshot via the `aeo:ingest-screenshot` plugin command;
   the skill emits `sampling_path: "screenshot"`.

The output is one row per (engine, question) — never invent citations.
If a sampling failed, set `cited=false` and add a note in `cited_snippet`.

Aggregate per-engine into `share = n_citations / n_questions` for the
window described by `window_start` and `window_end` (UTC ISO8601).

## Stop conditions
- Never sample more than 1 question per engine per 10 seconds (basic ToS-safe rate).
- Never log cookies, session tokens, or user PII from the browser session.
- If the user's session is logged out, raise `PLAYWRIGHT_AUTH_EXPIRED` and stop.
