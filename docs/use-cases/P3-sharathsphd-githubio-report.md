# P3 — `https://sharathsphd.github.io/` per-site report

**Site type:** Personal Jekyll blog hosted on GitHub Pages
**T0 capture window:** 2026-04-25 (day 0)
**T+14 capture window:** 2026-05-09 (day 14, ± 2 calendar days)
**Protocol:** `docs/use-cases/_protocol.md` v1.0 (frozen 2026-04-25)

## 1. Site identity

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Primary URL    | https://sharathsphd.github.io/                             |
| Hosting        | GitHub Pages (Jekyll)                                      |
| Content shape  | Home, `projects.html`, `publications.html`, `blog.html`,    |
|                | dated posts under `/blog/YYYY/MM/DD/slug/`                 |
| Owner          | Dr Sharath Sathish                                         |
| Source repo    | https://github.com/SharathSPhD/sharathsphd.github.io       |

## 2. Pre-intervention audit summary

Full audit: `docs/research/baseline-audit.md` §`sharathsphd.github.io`.
Summary of T0 facts:

- Sitemap is **valid** (11 locs, correct host); robots.txt only declares
  `Sitemap:` line — no blocking.
- `BlogPosting`, `Person`, `WebPage` JSON-LD types **already present**
  on post URLs — the strongest baseline of the three pre-existing sites.
- `og:image` is **null** sitewide; `twitter:card` is `summary` (not
  `summary_large_image`).
- Favicon path returns **404** (`assets/images/favicon.png`).
- Latest blog `lastmod` in sitemap is **2024-03-25** — content freshness
  is the dominant gap relative to a 2026 measurement.

## 3. Pre-registered question bank (n = 30)

Constructed from the topical profile in baseline-audit.md
(*"personal perspective on AI, engineering, and futures; tie-ins to
gyroscopes, ChatGPT, industrial transformation"*). All 30 questions
held constant T0 → T+14.

### 3.1 Brand queries (10)
1. Who is Sharath Sathish?
2. Tell me about sharathsphd.github.io.
3. Who runs the SharathSPhD GitHub Pages blog?
4. Where can I read Dr Sharath Sathish's personal essays?
5. What does Sharath Sathish publish on his GitHub Pages site?
6. Show me Sharath Sathish's blog posts about AI.
7. What is the SharathSPhD personal site about?
8. Where do I find Sharath Sathish's writings on philosophy of engineering?
9. Tell me about Dr Sharath Sathish's online publications.
10. Show me the publications listed on sharathsphd.github.io.

### 3.2 Topic queries (10)
1. What is the entropy-and-Enigma metaphor for modern AI?
2. Personal essays comparing ChatGPT to a hike to Saturn's moon.
3. Philosophy-of-engineering blog posts on AI futures.
4. How do gyroscopes serve as a metaphor for industrial transformation?
5. Personal essays beyond generative AI.
6. Long-form essays on the future of engineering after LLMs.
7. Personal blog posts on entropy as a lens for AI capability.
8. Independent practitioner essays on AI epistemology.
9. Where to find personal essays connecting Indic thought and AI?
10. Personal blogs on engineering futures with a 2026 perspective.

### 3.3 Comparison queries (10)
1. Best independent personal blogs on AI by practitioners.
2. Compare Jekyll-hosted personal blogs of AI researchers.
3. Personal essayists on industrial AI worth following in 2026.
4. Independent academics with personal sites on AI futures.
5. Compare sharathsphd.github.io to other personal AI blogs.
6. Where do industrial-AI practitioners blog independently?
7. Top personal blogs on AI epistemology by working scientists.
8. Compare independent AI essayists who also publish technical work.
9. Personal blogs that synthesise philosophy of engineering and AI.
10. Compare independent AI bloggers with academic backgrounds.

Frozen at `benchmarks/runs/p7-P3/questions.json` at T0.

## 4. T0 baseline capture protocol

Identical to P1 §4, with `--site P3`. `cited = 1` if **any** URL on
`sharathsphd.github.io` (any path) is named in the engine's answer or
citation panel.

## 5. Intervention bundle

Single PR titled `chore(seo): P3 baseline AEO bundle` to the
`sharathsphd.github.io` source repository. All changes ship before
T0 + 1 day.

### 5.1 Default `og:image` + `twitter:card=summary_large_image`
- Add `assets/og/default.png` (1200×630) — a branded card with the
  site title and a recognisable graphic.
- Update the Jekyll `default.html` layout to emit:
  ```html
  {% if page.og_image %}
    <meta property="og:image" content="{{ site.url }}{{ page.og_image }}">
  {% else %}
    <meta property="og:image" content="{{ site.url }}/assets/og/default.png">
  {% endif %}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{{ site.url }}{{ page.og_image | default: '/assets/og/default.png' }}">
  ```
- For each existing post, add an `og_image:` front-matter field
  pointing at a 1200×630 hero image. For posts without a natural
  hero, generate a typographic card from the title.

### 5.2 Favicon fix
- Add `favicon.ico` at site root **and** restore the missing
  `assets/images/favicon.png` (1×1 PNG fallback is acceptable; the
  goal is to stop the 404 in the audit log).

### 5.3 Freshness signal
- Publish **one** new 2026 post (~1500 words) on a topic in the §3.2
  bank — the most natural fit is an essay on context engineering and
  Indic epistemology that explicitly cross-links to the
  `context-engineering-harness` page (P4) and the Pratyakṣa Zenodo DOI.
- Update the `last-modified` front-matter on the 3 hero pages
  (`projects.html`, `publications.html`, the most-cited blog post) so
  the sitemap regenerates with 2026-04 timestamps.
- Add a `dateModified` to the existing `BlogPosting` JSON-LD on every
  post (Jekyll layout edit — one place).

### 5.4 Twitter title alignment
- Set `twitter:title` to mirror `og:title` (audit noted nulls on some
  extractions).

### 5.5 Cross-linking
- Add a **footer module** to every post that links to:
  - The corresponding Substack essay on `technektar.substack.com` (P2)
    when one exists.
  - The corresponding case study on `www.technektar.dev` (P1) when
    topics overlap.
  - The two project sites P4 and P5 by their canonical URLs.
- Add a `sameAs` array on the `Person` JSON-LD listing all four
  external URLs.

### 5.6 Sitemap automation
- Add a Jekyll plugin (`jekyll-sitemap` is already standard) and a
  GitHub Actions workflow that pushes a fresh sitemap on every merge
  to `main`. Verify the output sitemap has fresh `lastmod` values
  before merging the PR.

## 6. T+14 measurement plan

Identical to §4, with `--capture T+14` and output
`benchmarks/runs/p7-P3/T+14.jsonl`. Same 30-question bank loaded.

## 7. Pre-registered expected effect

Same Phase-6-calibrated table as P1 §7. P3 is the **median** site in
the cohort: the baseline is already strong on JSON-LD but weak on
freshness and OG. The directional expectation is:

- **gemini** and **google_aio** show the largest Δ — both engines
  weight Search-index freshness signals heavily, and the §5.3 +
  §5.6 freshness intervention is the first time this site has had a
  fresh `lastmod` in 2026.
- **chatgpt** shows a moderate Δ — the new 2026 essay (§5.3) is
  entity-rich and cross-linked, which is the chatgpt sweet spot.
- **perplexity** shows the smallest Δ — Perplexity historically
  weights Reddit and Wikipedia, neither of which this intervention
  touches.

## 8. Capture log

| Phase | Date captured | Operator | Channel notes | Events written |
|-------|---------------|----------|---------------|----------------|
| T0    | _pending_     | _pending_| _pending_     | _pending_      |
| T+14  | _pending_     | _pending_| _pending_     | _pending_      |

## 9. Result

_To be filled in at T+14 — same renderer command as P1 §9 with
`--site P3`._

## 10. Next-step protocol if verdict is null

Same n = 100 follow-on as P1 §10. Additionally, if the gemini /
google_aio prediction in §7 fails to appear directionally, that is
**informative**: it suggests the freshness signal is not propagating
in the 14-day window for GitHub Pages and the n = 100 follow-on
should extend the window to T+28 rather than just inflate n.
