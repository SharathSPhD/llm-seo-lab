# P4 — `https://sharathsphd.github.io/context-engineering-harness/` per-site report

**Site type:** Indie OSS docs site (Pratyakṣa context-engineering harness)
**T0 capture window:** 2026-04-25 (day 0)
**T+14 capture window:** 2026-05-09 (day 14, ± 2 calendar days)
**Protocol:** `docs/use-cases/_protocol.md` v1.0 (frozen 2026-04-25)

## 1. Site identity

| Field          | Value                                                       |
|----------------|-------------------------------------------------------------|
| Primary URL    | https://sharathsphd.github.io/context-engineering-harness/  |
| Hosting        | GitHub Pages (project-pages subpath, hand-rolled HTML)      |
| Content shape  | Single long landing page; ~75 KB HTML; ~7,000 word essay   |
| Owner          | Dr Sharath Sathish                                          |
| Source repo    | https://github.com/SharathSPhD/context-engineering-harness  |
| Authority anchor | Zenodo DOI `https://zenodo.org/records/19653013` (v2.0)   |

## 2. Pre-intervention audit summary

Fresh audit captured in `_protocol.md` §6 (P4). Headline:

- **Strong** head meta: `<title>`, `meta description`, full `og:*`
  set including `og:image=...lostmiddle.png`, `twitter:card=summary_large_image`.
- **Zero** `application/ld+json` blocks on a 75 KB page.
- **Not listed** in the user-site sitemap
  (`https://sharathsphd.github.io/sitemap.xml`).
- Has a real **Zenodo DOI** linked in-page — the rare case of an
  external citable preprint anchored to an indie page.
- Hand-rolled HTML, no Jekyll layout — schema and sitemap edits are
  source-edits, not theme edits.

## 3. Pre-registered question bank (n = 30)

Constructed from the in-page H1 and meta description:
*"When the Context Window Is Big and the Agent Is Still Confused — A
millennia-old darśana-śāstra vocabulary turned out to be the missing
operating manual for modern AI agents."*

### 3.1 Brand queries (10)
1. What is the Pratyakṣa context-engineering harness?
2. Who built the context-engineering-harness on GitHub?
3. Tell me about Dr Sharath Sathish's context engineering project.
4. What is the SharathSPhD context engineering harness?
5. Where can I find the context-engineering-harness Zenodo preprint?
6. What is the lostmiddle.png illustration about?
7. Show me the canonical landing page for Pratyakṣa.
8. What is the v2.0 release of context-engineering-harness?
9. Who is the author of the context-engineering harness on GitHub Pages?
10. Where is the documentation for the Pratyakṣa system?

### 3.2 Topic queries (10)
1. What is the "lost in the middle" problem in long context windows?
2. How does darśana-śāstra apply to modern AI agents?
3. What does pratyakṣa mean in classical Indian philosophy?
4. Practical techniques for context engineering in long-context LLMs.
5. How do I install a context-engineering plugin for an AI agent?
6. What is the missing operating manual for modern AI agents?
7. Sanskrit epistemology applied to LLM reasoning failures.
8. Open source tooling for context engineering with Claude or Cursor.
9. Methods for keeping AI agents focused inside large context windows.
10. Indic theories of perception applied to large language models.

### 3.3 Comparison queries (10)
1. Compare open-source context-engineering toolkits for LLM agents.
2. Best Sanskrit-inspired vocabularies for AI system design.
3. Compare Pratyakṣa to other context-engineering frameworks.
4. Open source projects that ground AI agents in classical philosophy.
5. Best indie projects on long-context reasoning in 2026.
6. Compare the context-engineering-harness to LangGraph and DSPy.
7. Indie OSS projects bridging Indic thought and AI tooling.
8. Best resources for context engineering beyond OpenAI's docs.
9. Compare hand-rolled context-engineering harnesses on GitHub.
10. Independent research projects with Zenodo-backed AI tooling preprints.

Frozen at `benchmarks/runs/p7-P4/questions.json` at T0.

## 4. T0 baseline capture protocol

Identical to P1 §4, with `--site P4`. `cited = 1` if **any** URL on
`sharathsphd.github.io/context-engineering-harness/` (any subpath) **or**
the Zenodo DOI `https://zenodo.org/records/19653013` is named in the
engine's answer or citation panel. Zenodo is included because the page
explicitly delegates citability to the DOI; an engine that cites the
DOI is honouring the page's intended citation surface.

## 5. Intervention bundle

Single PR titled `chore(seo): P4 baseline AEO bundle` to the
`context-engineering-harness` repo. All changes ship before T0 + 1 day.

### 5.1 JSON-LD blocks (the missing piece)
Add these blocks to the page `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "When the Context Window Is Big and the Agent Is Still Confused",
  "description": "...",
  "author": {
    "@type": "Person",
    "name": "Dr Sharath Sathish",
    "url": "https://www.technektar.dev/",
    "sameAs": [
      "https://technektar.substack.com/",
      "https://sharathsphd.github.io/",
      "https://github.com/SharathSPhD"
    ]
  },
  "datePublished": "2026-04-21",
  "dateModified": "2026-04-21",
  "citation": {
    "@type": "ScholarlyArticle",
    "name": "Pratyakṣa: A darśana-śāstra context-engineering harness for modern AI agents",
    "identifier": "10.5281/zenodo.19653013",
    "url": "https://zenodo.org/records/19653013"
  },
  "about": [
    { "@type": "Thing", "name": "context engineering" },
    { "@type": "Thing", "name": "darśana-śāstra" },
    { "@type": "Thing", "name": "long-context language models" }
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  "name": "context-engineering-harness",
  "codeRepository": "https://github.com/SharathSPhD/context-engineering-harness",
  "programmingLanguage": "Python",
  "license": "https://opensource.org/license/MIT",
  "author": { "@type": "Person", "name": "Dr Sharath Sathish" }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the lost-in-the-middle problem?",
      "acceptedAnswer": { "@type": "Answer", "text": "..." }
    },
    {
      "@type": "Question",
      "name": "What is darśana-śāstra and why does it matter for AI agents?",
      "acceptedAnswer": { "@type": "Answer", "text": "..." }
    },
    {
      "@type": "Question",
      "name": "How do I install the Pratyakṣa harness in 30 seconds?",
      "acceptedAnswer": { "@type": "Answer", "text": "..." }
    }
  ]
}
</script>
```

The `FAQPage` block is deliberately placed: every audit in
`docs/research/geo-evidence-base.md` agrees that explicit Q&A blocks
lift comparison-query citation rates on chatgpt and gemini.

### 5.2 Add page to user-site sitemap
- Edit `https://sharathsphd.github.io/sitemap.xml` (in the
  `sharathsphd.github.io` repo) to add a `<url>` entry for
  `https://sharathsphd.github.io/context-engineering-harness/` with
  `lastmod=2026-04-21`.
- Add a back-link in `https://sharathsphd.github.io/projects.html`
  to the project page (this is also part of P3 §5.5).

### 5.3 Cross-link from owner site
- Add a card on `https://www.technektar.dev/` (or its projects
  section) linking to the project page (this is part of P1 §5.5).
- Add an editorial Substack post on `technektar.substack.com`
  introducing Pratyakṣa with a permalink (this is part of P2 §5.4).

### 5.4 In-page anchor improvements
- Add explicit `id`-anchored sections matching the §3.2 question
  vocabulary (`#what-is-pratyaksha`, `#install-in-30-seconds`,
  `#lost-in-the-middle`). Engines that cite the page will deep-link
  to the relevant section.
- Add a short "Cite this page" block near the top of the article
  reproducing the Zenodo DOI BibTeX.

## 6. T+14 measurement plan

Identical to §4, with `--capture T+14` and output
`benchmarks/runs/p7-P4/T+14.jsonl`. Same 30-question bank loaded.

## 7. Pre-registered expected effect

Same Phase-6-calibrated table as P1 §7. P4 is the **most upside-leveraged**
site in the cohort because:

1. The baseline already has strong head meta (so head signals are
   not the bottleneck).
2. The baseline has **zero** structured data — adding the §5.1 blocks
   is the largest possible relative move.
3. The Zenodo DOI gives engines a **citable scholarly anchor** — any
   engine that prefers to cite a peer-reviewable artifact can pivot
   to the DOI when answering topic queries.

Directional pre-registration: **claude_ai** and **chatgpt** show the
largest Δ (both prefer scholarly anchors and FAQ-typed answers);
**perplexity** lifts moderately (Wikipedia-leaning, but the topic is
classical-philosophy-adjacent which Perplexity has a soft spot for);
**gemini** and **google_aio** lift via the FAQ schema and fresh
sitemap entry.

## 8. Capture log

| Phase | Date captured | Operator | Channel notes | Events written |
|-------|---------------|----------|---------------|----------------|
| T0    | _pending_     | _pending_| _pending_     | _pending_      |
| T+14  | _pending_     | _pending_| _pending_     | _pending_      |

## 9. Result

_To be filled in at T+14 — same renderer command as P1 §9 with
`--site P4`._

## 10. Next-step protocol if verdict is null

Same n = 100 follow-on as P1 §10. Additionally, if the FAQPage block
in §5.1 is the dominant lift driver per the directional pattern, the
n = 100 follow-on adds 30 more comparison-query questions (the cell
where FAQ schema historically helps the most).
