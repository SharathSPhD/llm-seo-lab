# P2 — `https://technektar.substack.com/` per-site report

**Site type:** Substack publication (essays + notes)
**T0 capture window:** 2026-04-25 (day 0)
**T+14 capture window:** 2026-05-09 (day 14, ± 2 calendar days)
**Protocol:** `docs/use-cases/_protocol.md` v1.0 (frozen 2026-04-25)

## 1. Site identity

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Primary URL    | https://technektar.substack.com/                           |
| Notes URL prefix | `https://substack.com/@technektar/note/...`              |
| Hosting        | Substack platform                                          |
| Content shape  | Home, About, Archive, RSS feed, ~5 posts in feed at T0     |
| Owner          | Dr Sharath Sathish ("TechNektar")                          |

## 2. Pre-intervention audit summary

Full audit: `docs/research/baseline-audit.md` §`technektar.substack.com`.
Key facts that constrain the intervention bundle:

- Substack manages sitemap, redirects, JS payload, and CWV — the operator's
  control surface is platform-side **publication settings**, **post
  metadata**, and **editorial decisions**, not source files.
- OG/Twitter cards are already strong. Schema is `Person`-typed on home;
  `Article` is partially client-rendered.
- robots.txt has **no per-agent block** for GPTBot/ClaudeBot/Perplexity —
  posts are crawlable by AI engines under the default `*` rules.
- H1 is empty in the static HTML (client-rendered) — engines that fetch
  static HTML rely on `og:title` / `<title>` for the page heading.

The intervention bundle in §5 therefore lives entirely in the
Substack admin UI and in editorial cross-linking; there are **no source
diffs** for this site.

## 3. Pre-registered question bank (n = 30)

Constructed from the topical profile in baseline-audit.md
(*"AI + innovation commentary, Indian epistemology / philosophy of
science as applied to LLMs, Navya-Nyaya, darśana-śāstra"*). All 30
questions held constant T0 → T+14.

### 3.1 Brand queries (10)
1. What is TechNektar?
2. Who writes the TechNektar Substack?
3. Tell me about technektar.substack.com.
4. What does Dr Sharath Sathish publish on Substack?
5. Where can I read TechNektar essays online?
6. What is Sharath Sathish's writing voice on epistemology and AI?
7. Show me TechNektar's most recent posts.
8. What topics does TechNektar cover?
9. Is TechNektar Substack worth subscribing to for AI commentary?
10. Where do I find Sharath Sathish's long-form essays?

### 3.2 Topic queries (10)
1. How does Navya-Nyaya relate to LLM context engineering?
2. What is darśana-śāstra and how does it apply to AI agents?
3. Indian epistemology applied to language models.
4. Compare Western and Indian theories of perception in the context of AI.
5. What is the "lost in the middle" phenomenon in long context windows?
6. How do classical Sanskrit traditions inform modern AI architecture?
7. What is the architectures-of-artificial-mind essay about?
8. How can ancient pramana theory help interpret LLM outputs?
9. Essays on the philosophy of mind for AI practitioners.
10. What does sākṣī mean in the context of agentic systems?

### 3.3 Comparison queries (10)
1. Best independent essayists on AI and philosophy in 2026.
2. Compare Substack publications focused on the philosophy of AI.
3. Who writes about Indian epistemology and modern machine learning?
4. Substacks for thoughtful AI commentary beyond Stratechery.
5. Where do practitioners write about classical Indian thought and LLMs?
6. Compare TechNektar to other independent AI publications.
7. Indie AI Substacks worth following in 2026.
8. Who synthesises Indic philosophy with modern computer science?
9. Best long-form writing on context engineering from a non-Western lens.
10. Compare Substack-based AI commentary by independent practitioners.

Frozen at `benchmarks/runs/p7-P2/questions.json` at T0.

## 4. T0 baseline capture protocol

Identical to P1 §4, with `--site P2`. `cited = 1` if **any** URL on
`technektar.substack.com` (any path) **or** `substack.com/@technektar`
(any note) is named in the engine's answer or citation panel.

## 5. Intervention bundle (Substack admin + editorial only)

The intervention is **executed in the Substack admin UI** between T0
and T0 + 24h. There is no source-control diff. A single commit titled
`docs(p2): substack intervention log` to this report file logs every
admin action with the timestamp it was applied.

### 5.1 Publication settings
- **Tagline:** rewrite to a single sentence that names the entity
  ("Dr Sharath Sathish — essays at the intersection of Indian
  epistemology and modern AI.").
- **Categories:** set to `Technology` + `Philosophy` so AI engines
  reading the platform metadata get a typed signal.
- **About page:** rewrite to include explicit `sameAs`-style external
  links to `https://www.technektar.dev/` and
  `https://sharathsphd.github.io/`. Add a short bio paragraph that
  names the academic background and the indie-research stance.
- **Featured posts:** pin the 3 strongest AEO essays in the home rail
  (concretely: the Navya-Nyaya / darśana-śāstra / context-engineering
  trio that the audit identified as the entity-rich posts).

### 5.2 Per-post metadata pass
For each of the ≥ 5 published posts:
- Confirm Substack's auto-generated **OG image** is on-brand; replace
  the default header crop with a hand-picked image where the auto-crop
  is unflattering.
- Add a **2-sentence "what this is"** lede at the top of each post so
  static-HTML extractors get a paragraph-shaped summary even when the
  full body hydrates client-side.
- Tag each post with **3 categorical tags** (Substack `tags` field) drawn
  from the §3.2 topic-query vocabulary.

### 5.3 Editorial cross-linking
- Add a **"Related on technektar.dev"** footer link to the most
  topically-aligned case study from P1 in each post.
- Add the corresponding **back-link** from the case study to the
  Substack post (this work is done in P1's PR §5.5).
- Republish or **link** any `.dev` case study referenced in a Substack
  post so a reader following the link sees a continuous narrative
  surface.

### 5.4 Distribution
- **Cross-post** the next 1 essay to LinkedIn with a permalink to the
  Substack canonical URL (Substack permits this and the LinkedIn echo
  helps Bing/Discover indexing). This is a **one-time** distribution
  action; the report counts only Substack URL citations, not LinkedIn.

## 6. T+14 measurement plan

Identical to §4, with `--capture T+14` and output
`benchmarks/runs/p7-P2/T+14.jsonl`. The same 30-question bank from
T0 is loaded.

## 7. Pre-registered expected effect

Same Phase-6-calibrated table as P1 §7. P2 is the **strongest a
priori candidate** in the cohort because:

1. The platform already gives us strong head meta — the intervention
   is mostly editorial entity-strengthening, which historically
   shifts engines that weight `Person` schema (claude_ai, chatgpt).
2. Cross-linking with P1 lifts both endpoints by adding `sameAs`-style
   anchors that engines can traverse for entity disambiguation.

We pre-register the directional expectation that **claude_ai and
chatgpt** will show the largest Δ for P2; **google_aio** will be
flatter (AIO leans on Search index signals more than entity graph).

## 8. Capture log

| Phase | Date captured | Operator | Channel notes | Events written |
|-------|---------------|----------|---------------|----------------|
| T0    | _pending_     | _pending_| _pending_     | _pending_      |
| T+14  | _pending_     | _pending_| _pending_     | _pending_      |

## 9. Result

_To be filled in at T+14 — same renderer command as P1 §9 with
`--site P2`._

## 10. Next-step protocol if verdict is null

Same n = 100 follow-on as P1 §10, plus a Substack-specific
amplification step: if the directional pattern from §7 (claude_ai +
chatgpt strongest) **does** appear in the mean-Δ but doesn't cross the
α' bar, the n = 100 follow-on adds 70 questions weighted toward those
two engines' citation styles (more comparison and "best of" framings
for chatgpt; more entity-disambiguation framings for claude_ai).
