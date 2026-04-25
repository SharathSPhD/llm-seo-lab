# Baseline SEO + AEO audit — llm-seo-lab validation sites

**Effective date:** 2026-04-25  
**Output path:** `docs/research/baseline-audit.md`  
**Methodology note:** The **Firecrawl CLI** was not available in the audit execution environment (`firecrawl` and `npx` not on `PATH`). Data collection used **Python 3.9** (`urllib.request`, `ssl`, regex-based HTML head extraction) and **curl** against the same live URLs. **Core Web Vitals (LCP/INP/CLS)** were not measured with Lighthouse or CrUX; performance discussion uses **byte size, script tag counts, and image counts** as proxies. Every factual claim below cites the **URL that was actually fetched** as of the audit run.

**Cross-site page-fetch totals:** 38 automated HTTP GETs across three targeted BFS crawls (cap 50 pages per site), plus separate `robots.txt` / `sitemap.xml` / RSS verification fetches. Unique “meaningful” HTML content URLs are smaller after excluding stylesheets, feeds treated as non-page assets where noted, and binary/icon responses.

---

### Site: https://technektar.dev/ (resolves to https://www.technektar.dev/)

**Crawl summary**

- **Pages discovered:** BFS from `https://www.technektar.dev/` with same-site link expansion found **13** unique URLs; **8** sitemap entries in `https://www.technektar.dev/sitemap.xml` (see Technical SEO — sitemap is invalid hostnames). Content-rich HTML pages in scope: home (`/`, `/index.html`), and **six** `case-studies/*.html` files sampled in the crawl. Additional hits included static assets (e.g. `main.css`, `favicon.ico`) pulled via `href` — these should be excluded from “page” counts in future crawls. None of the 50-page caps were reached because internal link graph is small and self-contained.  
- **Top-level structure:** Single-page **portfolio** positioning (“Data Scientist & Innovation Leader” per homepage `H1` from `https://www.technektar.dev/`), top navigation to sections (Home, About, Experience, **Case Studies**, Publications, Contact), and static **case-study** detail pages (Connected / Critical Thinker / Improver–Innovator themes). No separate blog index; thought leadership is split between this site (case stories) and the Substack property.

**Technical SEO state**

- **HTTPS:** `curl -sIL` followed redirects to `https://www.technektar.dev/` with **HTTP 200** (fetched 2026-04-25).  
- **Canonical:** On `https://www.technektar.dev/` and sampled case-study pages, the automated `<link rel="canonical">` **was not found** in the first ~30KB of HTML (same extraction on `https://www.technektar.dev/case-studies/connected-city-university.html`) — *gap: duplicate paths `/` vs `/index.html` without a declared canonical as seen by the fetcher.*  
- **robots.txt** (`https://www.technektar.dev/robots.txt`, fetched): Cloudflare “Content-Signal” block is present. For `User-agent: *` it sets `Content-Signal: search=yes, ai-train=no` and `Allow: /`. A **second** `User-agent: *` block later repeats `Allow: /` and adds `Disallow: /admin/`, `Disallow: /content-backups/`. Named AI-related agents (`GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot`, `Applebot-Extended`, `Bytespider`, `meta-externalagent`, `Amazonbot`, `CloudflareBrowserRenderingCrawler`) are **`Disallow: /`** (full site). **Sitemap** line: `Sitemap: https://yourdomain.com/sitemap.xml` — **placeholder, not the live hostname.**  
- **sitemap.xml** (`https://www.technektar.dev/sitemap.xml`, fetched): file exists, **8** `<loc>` entries, but every `<loc>` uses **`https://example.com/...`**, not `www.technektar.dev` — sitemap is **structurally present but not valid** for this production domain. Example first line: `https://example.com/`. `lastmod` values shown: **2025-03-08**.  
- **Page title / meta description (homepage + 3 sampled case studies):** All four have **unique, descriptive** `<title>` and meta descriptions within sensible lengths (e.g. homepage title “Portfolio | Dr Sharath Sathish”, description on aerospace/energy/ML from `https://www.technektar.dev/`). Case studies: `.../connected-city-university.html` (“EU Supercritical CO₂ Research Initiative | Case Study”), `.../connected-turbine-monitoring.html` (“Steam Turbine Remote Monitoring System | Demonstrated Capability”), `.../improver-innovator-example.html` (“Information Entropy Pricing Solution | Demonstrated Capability”) — from crawl JSON.  
- **Schema.org / JSON-LD:** **0** `application/ld+json` blocks detected on homepage and case-study samples (`json_ld_blocks: 0` on `https://www.technektar.dev/` and case study URLs in crawl export).  
- **Open Graph + Twitter Card:** **Not present** in head for homepage (`og:title`, `twitter:card` nulls on `https://www.technektar.dev/` in extraction).  
- **Mobile / i18n:** `viewport` meta **present**; `<html lang="en">` on homepage. **No `hreflang`** (single locale).  
- **Internal link density / orphan risk:** **Low orphan risk** on a ~8-page commercial surface; case studies are cross-linked from navigation. Risk is **duplication** (`/` vs `/index.html`, asset URLs crawled) rather than true orphans.  
- **Core Web Vitals proxies:** Homepage HTML **~30,154** bytes; **2** `<script>` tags, **9** `img` references on home. Case-study pages: **1–2** scripts, **1–2** images typical — *light* compared with SPAs. **LCP:** not instrumented; likely **first hero text or first image** on each page. **Render-blocking JS:** small script count; no large client bundle like React apps on this static site. **CWV** validation requires **Lighthouse or field CrUX** — not run here.

**AEO / LLM-SEO state**

- **Answer-engine structure:** Case-study HTML uses **repeated, scannable sections** in plain text (e.g. “SITUATION / TASK / …” visible in text extracted from `https://www.technektar.dev/case-studies/connected-city-university.html`) — **good** for extractive quotes. **No** FAQ blocks or `FAQPage` JSON-LD observed. **No** `HowTo` schema.  
- **Entity-rich content:** **Yes** — named institutions, technologies (supercritical CO₂, EU programme), domains (aerospace, energy). Suitable for **citation-grade** factoids.  
- **“Definition / how it works” pages:** **Implicit** in case studies (technology explainers in-body) but no dedicated **glossary** or “What is sCO2?” URL separate from a case file.  
- **Freshness:** Sitemap `lastmod` **2025-03-08** for listed URLs in `https://www.technektar.dev/sitemap.xml`. HTTP `Last-Modified` for homepage not relied on in this pass.  
- **Robots posture vs AI crawlers (declared in `https://www.technektar.dev/robots.txt`):** **Training-oriented** crawlers in the file are **fully disallowed** (`Disallow: /` for `GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot`, `Applebot-Extended`, `Bytespider`, etc.). **This conflicts with** broad **AI input / RAG** use cases for Phase 7 unless policy is revisited. **PerplexityBot / Anthropic** are **not** named in the file; default rules after the file’s structure would need careful parsing in a user-agent simulation — the safe statement is: **listed industry crawlers are blocked; unlisted crawlers are not given explicit `Allow` beyond the generic `*` `Allow: /` blocks, but Cloudflare-specific agents are denied.**

**Content / topic surface**

- **Authoritative on (from top pages only):** Industrial **data science**, **sCO2 / energy** research leadership, **remote monitoring** of rotating equipment, **pricing / entropy**-based analytics, **ISRO/GE**-style high-stakes problem solving narratives.  
- **Plausible buyer/research questions for citations:** “Who led EU supercritical CO₂ research collaboration at [context]?”, “Examples of **digital twin / remote monitoring** for steam turbines?”, “Applying **information entropy** to retail pricing in industrial B2B.”

**Top-10 prioritised gaps**

1. **High** — **Sitemap and robots sitemap line use wrong hostnames** (`example.com`, `yourdomain.com`) so search engines and auditors cannot trust discovery (`https://www.technektar.dev/sitemap.xml`, `https://www.technektar.dev/robots.txt`).  
2. **High** — **No JSON-LD** (`Person`, `Organization`, `Article`/`CreativeWork` for case studies) on key templates — from homepage/case fetches.  
3. **High** — **Explicit `Disallow: /` for major AI/aggregator user-agents** in `https://www.technektar.dev/robots.txt` — blocks training/crawling; decide policy for AEO vs IP.  
4. **Med** — **Missing Open Graph and Twitter** tags on the owner site (`https://www.technektar.dev/`) — weak social/AI card previews.  
5. **Med** — **No canonical** tags observed — duplicate `/` vs `/index.html` risk.  
6. **Med** — **No `og:image` / structured image** for case studies in social graph — link unfurls will be text-only.  
7. **Med** — `Content-Signal: ... ai-train=no` under EU framing — may signal **refusal to train**; align with product stance on `ai-input` for RAG.  
8. **Low** — **No hreflang** (acceptable for English-only).  
9. **Low** — Sitemap `lastmod` could be **automated on deploy** to reflect real updates.  
10. **Low** — BFS picked **CSS and favicon** as “pages” — **crawler allowlist** should restrict to `text/html` and trim assets from page inventory.

**Quick wins (≤5)**

1. Fix **`Sitemap:`** in `https://www.technektar.dev/robots.txt` to `https://www.technektar.dev/sitemap.xml` and **rewrite all sitemap `<loc>`** to `https://www.technektar.dev/...` (verified need from `https://www.technektar.dev/sitemap.xml`).  
2. Add **one** global JSON-LD **`Person` + `Organization`** block on the homepage template.  
3. Add **OG + Twitter** meta + a **default OG image** (portrait or logo) on home and case-study templates.  
4. **Insert `<link rel="canonical">`** on every HTML page, preferring the **https://www** variant without `index.html`.  
5. Document a **one-page decision** on which bots stay blocked vs allowlisted for **Phase 7** (training vs RAG) so robots.txt matches the business stance.

---

### Site: https://technektar.substack.com/ (Substack publication)

**Crawl summary**

- **Pages discovered:** BFS from `https://technektar.substack.com/` produced **11** fetches; platform links also resolve some content on **`https://substack.com/@technektar/...`**. Main publication URLs include home, About, Archive, Subscribe, and RSS. **Sitemap** (`https://technektar.substack.com/sitemap.xml` and common index paths) returned **HTTP 404** in this run — **no XML sitemap** at the checked standard paths. **Discovery** relies on in-app index + **RSS** (`https://technektar.substack.com/feed` **HTTP 200**, large payload; **5** `<item>` entries in RSS for recent posts, counted from the same feed URL).  
- **Top-level structure:** Standard **Substack** — publication home, **Archive**, **About**, subscribe flows, and **Substack “notes”/posts** (some on `substack.com` user profile URL space). Heavily **JS-driven** (see Technical).

**Technical SEO state**

- **HTTPS:** `https://technektar.substack.com/` **200** (fetched).  
- **Canonical / OG / Twitter (homepage `https://technektar.substack.com/`):** **Present** — `canonical: https://technektar.substack.com/`; `og:title`, `og:description`, `og:image` (Substack CDN image URL with fetch/transform parameters), `og:url`; `twitter:card: summary_large_image`, `twitter:title` — from crawl export. **Stronger than the owner .dev site** for share cards.  
- **robots.txt** (`https://technektar.substack.com/robots.txt`, full **497** bytes, fetched): **No** per-agent rules for `GPTBot`, `ClaudeBot`, `CCBot`, `PerplexityBot`, `Bytespider`, or `Google-Extended` in the file body. `User-agent: *` has **Disallow** rules for app paths (`/action/`, `/publish`, `/sign-in`, …). **`User-agent: BLEXBot` → `Disallow: /`**. `facebookexternalhit` has explicit **Allow** rules. **Implication:** Public posts are **not** blanket-disallowed for generic `*`; platform-specific and scraper rules apply.  
- **sitemap:** No sitemap at tested URLs; **use RSS** (`/feed`) and on-site Archive for discovery.  
- **Title / description samples:** **Home** — `https://technektar.substack.com/`: “TechNektar | Substack” + long description of AI/innovation focus. **Archive** — `https://technektar.substack.com/archive`: “Full archive of all the posts from TechNektar.” **About** — `https://technektar.substack.com/about`: “About - TechNektar” with the same default publication description. **Content note page** (sample) — `https://substack.com/@technektar/note/p-194719040` “When the Context Window Is Big and the Agent Is Still Confused” with long `og:description` — **third-party** Substack property URL, still the same author brand.  
- **Schema / JSON-LD:** At least **1** JSON-LD block on home; **`@type: Person`** detected in `ld_types_hint` on `https://technektar.substack.com/` in extraction. **Not** full `Article` on every view from static HTML — Substack may hydrate more in JS.  
- **Viewport / lang / hreflang:** `en`, viewport present. **No hreflang** (single language). **Homepage H1** empty in regex extraction (likely **client-rendered** H1) — *headless SEO risk for dumb crawlers* mitigated by strong meta and platform reputation.  
- **Internal link density / orphan risk:** **Platform manages**; `/archive` and `/feed` connect content. **Orphan** risk **low** for published posts.  
- **CWV proxies:** **~186** `<script>` tags on Archive HTML (`https://technektar.substack.com/archive` per crawl) — **heavy** third-party and bundle JS typical of Substack. **CWV** must be measured in **Lighthouse (mobile)** — not run here. **LCP** likely **large** due to images via CDN and JS hydration.

**AEO / LLM-SEO state**

- **Answer-engine structure:** Long-form **notes and posts**; titles are **LLM-quotable** (e.g. epistemology, “Architectures of Artificial Mind” from `https://substack.com/@technektar/note/p-188946951` metadata). Extraction is **strong on intent**; on-page H1 not always in static HTML (see above).  
- **Entity-rich content:** **High** — philosophy of mind, ML, **Navya-Nyaya**, etc. (from titles/descriptions in crawl). **Strong citation surface** for niche AI+philosophy queries.  
- **Definition / explainer pages:** **Primarily** essay-style; **not** a structured docs site.  
- **Freshness:** Publication meta on home says “Launched **2 months ago**” in description from `https://technektar.substack.com/` (relative to a Substack build string — **verify** in UI; independent `lastBuildDate` in RSS is the authoritative source for automation).  
- **AI bot posture:** `https://technektar.substack.com/robots.txt` as fetched — **no explicit** `GPTBot` stanza; **contrast** with the owner `.dev` site where **major** bots are **disallowed** — **strategic** difference if brand wants Substack to be the **federated** discoverable layer.

**Content / topic surface**

- **Authoritative on:** **TechNektar** brand, **AI + innovation** commentary, **Indian epistemology / philosophy of science** as applied to LLMs (per note titles in crawl).  
- **Citation questions:** “How does **Navya-Nyaya** relate to LLM fine-tuning?”, “**Darśana-śāstra** vocabulary for context windows” — *examples aligned to actual post titles in crawl.*

**Top-10 prioritised gaps (within platform constraints)**

1. **High** — **Substack** limits control of **sitemap,** **redirect chains,** and **JS payload**; **CWV** may stay **Med** without platform changes — track **Core Web Vitals in Search Console** for the custom domain if attached.  
2. **High** — **H1** not visible to regex on home/archive — if Google also sees the same, **rely on title/OG**; use **Substack’s SEO** settings and **headline** fields for AEO.  
3. **Med** — **Distribution split** between `technektar.substack.com` and `substack.com/@technektar/...` — **one canonical** brand URL pattern for sharing (prefer publication links where possible).  
4. **Med** — **Archive description** is generic; consider **custom** publication tagline/SEO in Substack (field-level on platform).  
5. **Med** — **Feed** has **5** items; ensure **all** long-term posts stay **discoverable** from Archive and internal **related links** (platform-dependent).  
6. **Med** — **Schema depth** (Article, author sameAs) is **not fully visible** in static HTML; accept **Substack defaults** or use **import custom HTML** where Substack allows.  
7. **Low** — **Image-heavy OG** already present — add **branded** card consistency across notes vs home.  
8. **Low** — **Podcast / video** embeds (if any) not audited — may affect **INP** on mobile.  
9. **Low** — `BLEXBot` disallowed only for that user-agent, not a broad ban — **low impact** unless a tool uses it.  
10. **Low** — **Transcripts** (for audio) for AEO **if** podcast exists — not verified in this pass.

**Quick wins (≤5)**

1. In Substack **Settings → Publication details**, set **tagline, categories, and social proof** to reinforce **entity** (“Dr Sharath Sathish”, `sameAs` links) — *UI-only, no code.*  
2. **Pin** the **3** strongest AEO pieces on the **home/Featured** order (Substack feature).  
3. **Use consistent permalinks** for social sharing — prefer `https://technektar.substack.com/...` when the platform offers both.  
4. **Monitor** `https://technektar.substack.com/feed` in **Feed readers** and **Bing/Discover**; fix any **404** subscription links.  
5. **Republish** or **link** the `.dev` case studies in **Substack** posts for **one canonical** narrative (manual editorial).

---

### Site: https://sharathsphd.github.io/ (GitHub Pages — **confirmed 200; used for this slot**)

**Crawl summary**

- **URL validation:** `https://sharathsphd.github.io/` returned **HTTP 200**; **not** empty. The GitHub user **SharathSPhD** has other repos with `has_pages: true` on the GitHub API (e.g. `attractor-flow-plugin-bench`, `coffee_causality`, `context-engineering-harness` — **not** audited in depth) — **this audit** uses the **sitemap-listed personal site** as the primary SharathSPhD GitHub Pages property per the project’s Phase 7 target list.  
- **Pages discovered:** BFS **14** fetches. **`https://sharathsphd.github.io/sitemap.xml` lists **11** `<loc>`** entries (fetched) including blog posts, `blog.html`, `projects.html`, `publications.html`, and a `projectdoc/content_management.html` path. The crawl also requested **`https://sharathsphd.github.io/assets/images/favicon.png`** which returned **HTTP 404** in this run — *broken image reference risk.*  
- **Top-level structure:** Jekyll-style **static** site: **Home, Projects, Publications, Blog** with dated posts under `/blog/YYYY/MM/DD/slug/`.

**Technical SEO state**

- **HTTPS:** **200** on `https://sharathsphd.github.io/`; GitHub `Last-Modified: Sat, 08 Feb 2025 16:32:46 GMT` on homepage headers (fetched 2026-04-25).  
- **robots.txt** (`https://sharathsphd.github.io/robots.txt` if present): minimal line observed in short crawl: **`Sitemap: https://sharathsphd.github.io/sitemap.xml`** only (no blocking).  
- **Sitemap** (`https://sharathsphd.github.io/sitemap.xml`, fetched): **valid** locs for this host; `lastmod` on blog entries e.g. **2024-02-08** and **2024-03-25**.  
- **Canonical / OG / Twitter:** `https://sharathsphd.github.io/` has **canonical** and **OG** title/description; **`og_image` null** in extraction. Blog sample `https://sharathsphd.github.io/blog/2024/02/15/enigma-entropy/` has **Article-level** `og_title` and `og_description` from description field; still **`og_image` null**. `twitter:card: summary` (not large image).  
- **Title / description samples — Home, Blog index, 2 posts:** **Home** — long title and meta description; **Blog** `https://sharathsphd.github.io/blog` → canonical to `.../blog.html` (fetched). **Posts:** “Enigma & Entropy…” (`.../enigma-entropy/`) and “ChatGPT and a Hike to Saturn’s Moon” (`.../chatgpt-and-hike-to-saturn/`) — from crawl.  
- **Schema / JSON-LD:** **`BlogPosting`**, `Person`, `WebPage` types detected in `ld_types_hint` on post URLs (`https://sharathsphd.github.io/blog/2024/02/15/enigma-entropy/`, etc.) — **stronger structured basis** than `technektar.dev` at time of audit.  
- **Viewport / lang / hreflang:** `lang=en`, viewport; **no hreflang**.  
- **Internal linking:** Sitemap and nav connect posts; **low** sitewide page count.  
- **CWV proxies:** **~1** script per page in samples; **0** `img` tags on some posts in extraction — *text-heavy, fast* but **boring in SERP** without social images. **CWV** not measured.

**AEO / LLM-SEO state**

- **Structure:** **Essay** format with `H1` in static HTML. **No** heavy FAQ. **Definition-style** phrasing in titles (“Enigma & Entropy”, “Beyond Generative AI”) — *good* for long-tail queries.  
- **Entity richness:** **Moderate** — personal brand + technology metaphors. Less **B2B case fact** than `technektar.dev` case studies.  
- **Freshness:** **Blog** `lastmod` **2024** in sitemap; homepage **2025** `Last-Modified` header. **Aging** content for 2026 unless new posts are added.  
- **AI bots:** Default GitHub Pages + minimal robots — **no** explicit GPTBot block on `sharathsphd.github.io` robots in the observed snippet.

**Content / topic surface**

- **Authoritative on:** **Personal** perspective on **AI, engineering,** and **futures**; tie-ins to **gyroscopes, ChatGPT,** industrial transformation (from post titles in crawl).  
- **Citation questions:** “Metaphor of **hiking to Saturn** in AI,” **philosophy-of-engineering** essays — *aligned to post copy.*

**Top-10 prioritised gaps**

1. **High** — **`og:image` absent** sitewide in extraction — **poor** unfurls in Slack/X/LLM cards for `https://sharathsphd.github.io/`.  
2. **High** — **Favicon 404** on `https://sharathsphd.github.io/assets/images/favicon.png` — trust signal and browser chrome.  
3. **Med** — **Content freshness** lags 2024 posts vs “live” 2025 homepage file timestamp — *signal staleness* to engines.  
4. **Med** — **Twitter title** nulls on some extractions — confirm `twitter:title` in theme.  
5. **Med` — `BlogPosting` good — add explicit **`dateModified`** in JSON-LD if not present (verify source files).  
6. **Low** — **Image-free** posts — add **1** diagram per post for **Pinterest/Discover** and **multimodal** RAG.  
7. **Low` — `publications` duplicate or overlap between **`/publications` and blog publication page** in sitemap — check thin duplicate (`https://sharathsphd.github.io/blog/2024/02/08/publications/`).  
8. **Low` — **Internal search** on static site **none** — add **/search** or backlink to **.dev** portfolio for services.  
9. **Low` — **hreflang** N/A.  
10. **Low` — **HTTPS** and **HSTS** handled by GitHub.

**Quick wins (≤5)**

1. Add **`og:image`** (1200×630) in Jekyll front-matter or layout for **all** posts + home.  
2. **Fix** favicon path or add **`favicon.ico`** at site root.  
3. **Publish 1** new 2026 post **or** refresh “last updated” on the **3** hero pages to **signal** activity.  
4. In layout, set **`twitter:title`** to match `og:title` when `twitter:card` is `summary`.  
5. **Cross-link** each GitHub post to the **authoritative** case study on `https://www.technektar.dev` where topics overlap.

---

## Final cross-site section

### Comparison (key dimensions)

| Dimension | technektar.dev (`www`) | technektar.substack.com | sharathsphd.github.io |
|-----------|------------------------|-------------------------|------------------------|
| **HTTPS / 200** | Yes (redirects to `www`) | Yes | Yes |
| **Sitemap** | **Broken** (`example.com` in locs) | **404** on tested paths; use RSS | **Valid** 11 locs same host |
| **robots sitemap** | **Wrong** (`yourdomain.com`) | N/A in file | **Points** to sitemap |
| **JSON-LD** | **None** detected (home, cases) | `Person` on home; platform | **`BlogPosting`+`Person` on posts** |
| **OG / Twitter** | **Missing** | **Strong** | **Partial (no image)** |
| **AI bot policy** | **Many blocked** (GPTBot, etc.) | **Generic** Substack rules | **No** extra blocks in snippet |
| **JS weight (script tags)** | **Low** (1–2) | **High** (100s on archive) | **Low** (1) |
| **AEO: static extractability** | **Good** case-study text | **Strong** meta; **weak** static H1 | **Good** `H1`+posts |
| **Content freshness (proxy)** | sitemap 2025-03 | “2 months” copy on home; RSS | Blog **2024**; home file **2025** |

### Baseline scorecard (0–100)

Subjective, comparable rubric. **CWV not measured** — “Technical SEO” is **crawl + meta + sitemap/robots + schema** quality, not speed.

| Site | Technical SEO | AEO readiness | Content surface | Citation potential |
|------|---------------|--------------|-----------------|----------------------|
| **www.technektar.dev** | 38 | 56 | 63 | 52 |
| **technektar.substack.com** (incl. `substack.com/@technektar` notes in crawl) | 71 | 78 | 74 | 72 |
| **sharathsphd.github.io** | 64 | 60 | 58 | 64 |

*Rationale in short:* **.dev** has strong on-page text but **broken discovery files**, **no schema/OG**, and **aggressive** AI-agent blocks. **Substack** scores highest on **share/meta/AEO** but you **do not** control **sitemap/perf**. **GitHub** has the **best BlogPosting** baseline but **weak social images** and **older** blog `lastmod`.

### Phase 7: best test bed by intervention type

- **Intervention: Technical / crawl / structured data** — **Primary:** `https://www.technektar.dev/` (fix robots/sitemap, add JSON-LD, OG, canonical, bot policy). **Secondary:** `sharathsphd.github.io` (Jekyll can mirror schema patterns quickly).  
- **Intervention: AEO / long-form + LLM-quotable narrative** — **Primary:** `https://technektar.substack.com/` + `substack.com/@technektar/...` **notes** (platform-native distribution, strong `og:description` already). **Secondary:** `.dev` case studies for **B2B** fact extraction.  
- **Intervention: Citation + academic/personal brand** — **Primary:** `sharathsphd.github.io` (BlogPosting, essays). **Support:** link graph from Jekyll **→** `.dev` for **E-E-A-T** for professional credentials.

**Access / tooling blockers for this run**

- **Firecrawl CLI** unavailable (`command not found`); audit used **Python + curl** instead — **no 403** or paywall; **200** on all three primary home URLs. **Substack** and **.dev** require **JS** for full UI; head extraction captured **head-level** SEO; **H1** on Substack may be **incomplete** in static HTML. **No** Lighthouse. **Favicon 404** on one GitHub asset path as noted.

---

*End of baseline audit.*
