# P5 — `https://sharathsphd.github.io/attractor-flow-plugin-bench/` per-site report

**Site type:** Indie OSS benchmark site (EvolveSys × AttractorFlow 5-cycle bench)
**T0 capture window:** 2026-04-25 (day 0)
**T+14 capture window:** 2026-05-09 (day 14, ± 2 calendar days)
**Protocol:** `docs/use-cases/_protocol.md` v1.0 (frozen 2026-04-25)

## 1. Site identity

| Field          | Value                                                       |
|----------------|-------------------------------------------------------------|
| Primary URL    | https://sharathsphd.github.io/attractor-flow-plugin-bench/  |
| Hosting        | GitHub Pages (project-pages subpath, hand-rolled HTML+JS)   |
| Content shape  | Single benchmark landing with 7 inline scripts + ~268 KB    |
| Owner          | Dr Sharath Sathish                                          |
| Source repo    | https://github.com/SharathSPhD/attractor-flow-plugin-bench  |

## 2. Pre-intervention audit summary

Fresh audit captured in `_protocol.md` §6 (P5). Headline:

- **Weak** head meta: only `<title>` (`EvolveSys × AttractorFlow —
  5-Cycle Benchmark`); **no** `meta description`; **no** `og:*`;
  **no** `twitter:*`; **no** canonical link.
- **Zero** `application/ld+json` blocks on a 268 KB page.
- 7 inline scripts (chart and table renderers) — content is largely
  client-rendered for the data-heavy sections.
- Not listed in the user-site sitemap.
- This is the textbook case of a **research-grade content surface
  invisible to AI engines** because it has no metadata for engines to
  reason about.

## 3. Pre-registered question bank (n = 30)

Constructed from the page H1 (*EvolveSys × AttractorFlow*) and the
`docs/research/seo_research_2.md` references to attractor-flow as a
plugin in the project's tooling. All 30 questions held constant
T0 → T+14.

### 3.1 Brand queries (10)
1. What is the EvolveSys × AttractorFlow benchmark?
2. Tell me about the attractor-flow-plugin-bench on GitHub.
3. Who built the AttractorFlow plugin benchmark?
4. Where can I see the 5-cycle attractor-flow benchmark results?
5. Show me the SharathSPhD attractor-flow benchmark page.
6. What is the EvolveSys-AttractorFlow project?
7. Who created the attractor-flow GitHub Pages benchmark site?
8. Where do I find the attractor-flow plugin's published benchmark?
9. Tell me about the attractor-flow plugin authored by SharathSPhD.
10. What is the canonical landing for the attractor-flow benchmark?

### 3.2 Topic queries (10)
1. What is the attractor-flow methodology for evolutionary systems?
2. How do you benchmark a regime-detection plugin for AI agents?
3. What is the EvolveSys framework for system evolution?
4. Lyapunov exponents and basin depth for AI design-space exploration.
5. How do you detect regime bifurcations in long-running AI sessions?
6. Open source plugins for attractor analysis of AI workflows.
7. Methods for tracking attractor states across multi-agent runs.
8. What does a 5-cycle attractor-flow benchmark measure?
9. Practical use of attractor-flow in software engineering experiments.
10. How does perturbation analysis apply to AI agent reliability?

### 3.3 Comparison queries (10)
1. Compare attractor-flow with other regime-detection toolkits for AI.
2. Best open source benchmarks for AI plugin evaluation.
3. Independent benchmarks comparing AI agent reliability frameworks.
4. Compare attractor-flow to other Lyapunov-based AI analysis tools.
5. Benchmarks for regime detection in evolutionary computing.
6. Open source projects for attractor analysis in AI workflows.
7. Compare community benchmarks for regime-detection plugins.
8. Best public benchmarks tying dynamical systems to AI engineering.
9. Independent benchmark sites for Cursor or Claude Code plugins.
10. Compare 5-cycle benchmark methodologies for plugin evaluation.

Frozen at `benchmarks/runs/p7-P5/questions.json` at T0.

## 4. T0 baseline capture protocol

Identical to P1 §4, with `--site P5`. `cited = 1` if **any** URL on
`sharathsphd.github.io/attractor-flow-plugin-bench/` (any subpath) is
named in the engine's answer or citation panel. Citations to the
parent `attractor-flow` repo (`https://github.com/SharathSPhD/attractor-flow`)
without naming the benchmark URL are **not** counted.

## 5. Intervention bundle

Single PR titled `chore(seo): P5 baseline AEO bundle` to the
`attractor-flow-plugin-bench` repo. All changes ship before T0 + 1
day. The bundle is larger than P4 because the baseline is barer.

### 5.1 Add full head meta block
```html
<meta name="description"
      content="A pre-registered 5-cycle benchmark of the AttractorFlow
               regime-detection plugin against EvolveSys, with full
               event logs, basin-depth and Lyapunov reports, and
               reproducible run scripts.">
<link rel="canonical"
      href="https://sharathsphd.github.io/attractor-flow-plugin-bench/">

<meta property="og:type" content="website">
<meta property="og:title"
      content="EvolveSys × AttractorFlow — 5-Cycle Benchmark">
<meta property="og:description" content="<same as description>">
<meta property="og:url"
      content="https://sharathsphd.github.io/attractor-flow-plugin-bench/">
<meta property="og:image"
      content="https://sharathsphd.github.io/attractor-flow-plugin-bench/assets/og-card.png">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title"
      content="EvolveSys × AttractorFlow — 5-Cycle Benchmark">
<meta name="twitter:description" content="<same as description>">
<meta name="twitter:image"
      content="https://sharathsphd.github.io/attractor-flow-plugin-bench/assets/og-card.png">
```

Plus the `og:image` asset itself: a 1200×630 card with the
benchmark title and one chart from the page.

### 5.2 Add JSON-LD blocks
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "EvolveSys × AttractorFlow 5-Cycle Benchmark",
  "description": "<same as description>",
  "creator": {
    "@type": "Person",
    "name": "Dr Sharath Sathish",
    "url": "https://www.technektar.dev/"
  },
  "url": "https://sharathsphd.github.io/attractor-flow-plugin-bench/",
  "license": "https://opensource.org/license/MIT",
  "isAccessibleForFree": true,
  "keywords": [
    "attractor flow", "regime detection", "Lyapunov exponent",
    "basin depth", "AI plugin benchmark", "EvolveSys"
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  "name": "attractor-flow-plugin-bench",
  "codeRepository":
    "https://github.com/SharathSPhD/attractor-flow-plugin-bench",
  "programmingLanguage": ["Python", "JavaScript"],
  "license": "https://opensource.org/license/MIT",
  "author": { "@type": "Person", "name": "Dr Sharath Sathish" },
  "softwareRequirements":
    "https://github.com/SharathSPhD/attractor-flow"
}
</script>
```

`Dataset` is chosen deliberately: this is a benchmark with logged
results, and `Dataset` is the schema type that ChatGPT and Gemini
weight most heavily for "best benchmark for X" questions
(per `docs/research/citation-mechanisms.md`).

### 5.3 Static SSR for the chart-bearing sections
The 7 inline scripts render charts client-side; engines that fetch
static HTML do not see the chart's underlying numbers. The
intervention adds **static fallback `<table>` blocks** with the same
data, server-rendered at build time, sitting **before** the chart
container. The chart still hydrates on top in the browser; the
fallback is the AEO surface.

### 5.4 Add to user-site sitemap + projects page
- Add a `<url>` entry to `https://sharathsphd.github.io/sitemap.xml`
  with `lastmod` = the file modification date.
- Add a card on `https://sharathsphd.github.io/projects.html` linking
  to the benchmark (also part of P3 §5.5).

### 5.5 Cross-link from owner site + Substack + P4
- Add a card on `https://www.technektar.dev/` projects section
  (part of P1 §5.5).
- Reference the benchmark from any P4 section that discusses
  attractor-flow (one-line edit).

### 5.6 In-page anchors aligned to question vocabulary
Add `id`-anchored sections matching §3.2:
`#what-is-attractor-flow`, `#5-cycle-methodology`,
`#basin-depth-and-lyapunov`, `#perturbation-protocol`,
`#install-the-plugin`. Engines that cite the page will deep-link.

## 6. T+14 measurement plan

Identical to §4, with `--capture T+14` and output
`benchmarks/runs/p7-P5/T+14.jsonl`. Same 30-question bank loaded.

## 7. Pre-registered expected effect

Same Phase-6-calibrated table as P1 §7. P5 is the **highest-variance**
expectation in the cohort because the baseline is so bare:

- **Upside case:** the absence of any meta is the only blocker, and
  adding the §5.1 + §5.2 + §5.3 stack lifts citations on every
  engine that uses head meta as a primary feature — this could
  produce a **larger** Δ than the Phase 6 calibration suggests
  (Phase 6 assumed a baseline that already had some meta).
- **Downside case:** the topic is so niche that even with perfect
  meta, no engine has an organic surface for the comparison queries
  in §3.3 — Δ is near zero across all engines.

We pre-register the bidirectional expectation that **claude_ai** and
**chatgpt** should rise the most under the upside case (they cite
hand-rolled OSS docs more often than google_aio), and that
**perplexity** is the canary for the downside case (if perplexity
doesn't lift, the topic is too niche and the n = 100 follow-on
should pivot the question bank toward broader plugin/AI tooling
queries).

## 8. Capture log

| Phase | Date captured | Operator | Channel notes | Events written |
|-------|---------------|----------|---------------|----------------|
| T0    | _pending_     | _pending_| _pending_     | _pending_      |
| T+14  | _pending_     | _pending_| _pending_     | _pending_      |

## 9. Result

_To be filled in at T+14 — same renderer command as P1 §9 with
`--site P5`._

## 10. Next-step protocol if verdict is null

Same n = 100 follow-on as P1 §10. If the §7 downside case is realised
(perplexity does not lift), the follow-on **also** broadens the §3.3
comparison vocabulary toward generic "open source plugin benchmarks"
phrasings before re-measuring; if it still doesn't lift, that is a
genuine null and the report concludes that the topic is below the
citation-density floor of the current generation of AI engines.
