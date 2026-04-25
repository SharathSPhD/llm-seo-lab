# Citation and source-selection mechanisms in major AI answer engines

**Status:** research note · **as of:** 2026-04-25  
**Methodology:** Primary vendor documentation, official help centers, and peer-reviewed or widely cited research were prioritized. **Firecrawl CLI was not available in the research environment** (`firecrawl` / `npx` absent); retrieval used direct HTTP fetches and web search. Secondary industry analyses (Otterly.AI, SearchSignal, marketing blogs) are cited explicitly where used. Where vendors describe ranking “factors” without auditable code or experiments, this document labels them as **vendor claims**, not independent verification.

---

## 1. ChatGPT Search (OpenAI) — web search in ChatGPT

**Retrieval architecture (disclosed).** OpenAI states that ChatGPT search is a “fine-tuned version of GPT‑4o” that **leverages third-party search providers** (Microsoft’s Bing is named in third-party coverage and in the Help Center’s privacy section) **and content from publisher partners** to satisfy queries.[^openai-launch] The Help Center describes a **query-rewrite and multi-round retrieval** pattern: the model may turn one user question into one or more targeted queries to search partners, then issue **additional, more specific follow-up queries** after reviewing initial results.[^openai-help-search]

**Signals influencing inclusion (stated or inferable).** (1) **Crawl opt-in for search index:** the **OAI-SearchBot** user-agent is used to surface sites in ChatGPT search; disallowing it removes pages from *search answers* (navigational links may still appear). This is a hard gate for web-origin citations tied to the search index.[^openai-crawlers] (2) **Publisher licensing:** the launch post lists **AP, Axel Springer, Condé Nast, Dotdash Meredith, Financial Times, GEDI, Hearst, Le Monde, News Corp, Prisa, Reuters, The Atlantic, Time, Vox Media**, and frames partnerships as supply of up-to-date, trustworthy news and data.[^openai-launch] (3) **General ranking language:** help documentation says “ranking … is based on a number of factors” aimed at **reliable, relevant** information, without listing weights.[^openai-help-search] — Treat detailed weighting as **opaque** beyond the above.

**Partnerships / licensing (named).** Same list as in the product announcement; OpenAI also operates a `publishers-feedback@openai.com` channel and a **bots / platform** page for opt-in.[^openai-launch]

**Robots / crawlers (official).** Separate user-agents: **OAI-SearchBot** (search surfacing; full string on OpenAI’s page), **GPTBot** (training for foundation models), **ChatGPT-User** (user-initiated fetches; **robots.txt may not apply**), **OAI-AdsBot** (ad landing-page validation, not search placement).[^openai-crawlers]

**Attribution UI.** Help Center: **inline citations** with **hover** on desktop; **“Sources”** panel under the response; images may include citations when clicked.[^openai-help-search]

**Documented penalties.** **Paywalls / preview:** not enumerated in the cited docs. **Stale content:** not quantified. **OAI-SearchBot disallow** removes a site from search *answers* specifically.[^openai-crawlers]

**Reverse-engineering / empirical work.** (1) **Otterly.AI (2025–2026),** *commercial sample*: ≥1M citations across ChatGPT, Perplexity, and Google AI Overviews; reports **strong Reddit/Wikipedia concentration** and **platform-specific** brand vs. community citation splits (secondary; methodology summarized on their blog, not a peer-reviewed paper).[^otterly-2026] (2) **Princeton-led GEO (KDD 2024),** *academic black-box study*: “Generative Engine Optimization” treats engines as **proprietary**; **visibility** metrics and **query-level** experiments (including on Perplexity) find large swings from **content and citation-format** interventions—relevant to *inclusion* in answers, not to reverse-engineering OpenAI’s stack.[^geo-kdd]

**“We don’t know.”** Exact blend of **Bing index vs. partner feeds vs. OAI-SearchBot crawl**, per-query ranking function, and **re-ranking after retrieval** are **not** public. Third-party articles describing “Bing-backed” search are directionally right but not a full architectural spec.[^verge-bing]  

---

## 2. ChatGPT default mode (no web search) — “knowledge-only”

**Retrieval architecture.** When **web search is off** and no **uploaded files / connectors / memory-driven fetch** is invoked, the model answers from **parametric knowledge** (weights) and **context** (system + conversation + any user-provided text). This is **not** publisher-specific RAG over the public web. OpenAI documents **web search** as a separate, toggleable capability.[^openai-help-search]

**Fraction of “citations” from training cutoff vs. RAG.** In this mode, **end-user “citations” are typically absent** unless the product surface adds them. There is **no** published fraction of “answers grounded in post-training RAG” **without** browse—because the **grounding set is not a crawled index** in the search sense. If the user pastes a URL, **ChatGPT-User** may fetch it (user-initiated; robots rules *may not apply*).[^openai-crawlers] Optional **memory** and **custom GPTs** can change behavior (out of scope of “default chat” but important for product folks).

**Honest position.** Claiming a numeric **% training vs. RAG** for “citations” in default mode is **not supported** by public OpenAI documentation; the meaningful statement is: **default chat is not web RAG** unless the user or feature enables retrieval.

---

## 3. Perplexity AI (free and Pro)

**Retrieval architecture (external framing).** Perplexity markets a **search-assisted** Q&A product with **inline links**; developer docs describe **search APIs** and **Sonar** model family for RAG-style applications. The **exact proprietary index** (own crawl vs. syndicated partners) is **not fully itemized** in the snippets reviewed here; treat the web layer as a **hybrid search + LLM** unless Perplexity publishes a full data-flow diagram.[^perplexity-docs]

**Free vs. Pro (operational, not a separate “index” disclosure).** Industry pricing summaries claim **unlimited “standard” search** on free and higher caps on **“Pro search”** / **Deep Research**-style depth for Pro; underlying **index** is typically shared—difference is **budget, model tier (e.g. Sonar vs. Sonar Pro)**, and **depth of multi-step** search. For legal-grade statements, use Perplexity’s own pricing/help pages; third-party “honest guide” pages drift. (Vendor **claim** tier.)

**Publisher program (disclosed in press).** **Revenue share** and expanded **publisher lists** (Time, Der Spiegel, Independent, *etc.*) appear in 2024–2025 trade coverage; some publishers have litigated or sent **cease-and-desist**—affecting **licensing and liability**, not necessarily the free retrieval algorithm.[^perplexity-tc]  

**Crawler (common reference).** Industry lists reference **PerplexityBot** / **Perplexity-User**; verify current names on Perplexity’s own bot documentation before relying on `robots.txt` rules.[^otterly-2026]

**Signals (beliefs vs. evidence).** Blogs hypothesize **authority lists, freshness decay, and multi-layer reranking**; without Perplexity’s code, these are **hypotheses**. The **Otterly** study (above) is useful **empirically** for **what gets cited in the wild**, not for **internal feature weights**.[^otterly-2026]

**Attribution UI.** **Dense inline numeric citations** next to claims are a defining UX of Perplexity; API consumers get structured search + text.[^perplexity-docs]

**Reverse-engineering.** **GEO (Princeton)** tested **Perplexity.ai** with black-box **visibility** metrics.[^geo-kdd]

**“We don’t know.”** Public **score function** (beyond marketing “quality, relevance”) and any **deals-based boosting** in ranking.

---

## 4. Google AI Overviews (AIO) — in Search

**Retrieval architecture (Google’s own wording).** Google states AI Overviews and **AI Mode** use the **same Search ecosystem**; pages must be **indexed and eligible to show a snippet** for Search; **no extra technical requirements** specific to AIO.[^g-sc-ai] Retrieval uses **“query fan-out”** (multiple related searches / subtopics) to assemble a **wider set of links** than a single classic search might surface.[^g-sc-ai]

**Signals (official guidance, not a formula).** Google points publishers to **core Search quality** practices: **helpful content**, **structured data** consistent with visible text, **crawlability**, **page experience**, **textual (not only JS) content** for important material.[^g-sc-ai] This supports **E-E-A-T**-style *direction* but is **not** a public weight vector.

**Partnerships.** Not framed as a separate “AIO licensing” layer; **Search** and **Shopping** ads policies govern monetized surfaces.[^g-ads-note]

**Robots / controls.** **Googlebot** and standard **Search controls** (including `noindex`, snippet controls) apply. **Google-Extended** is called out for **separate** AI / training / grounding in *some other* Google systems—not a substitute for `Googlebot` rules for AIO in Search.[^g-sc-ai]

**Attribution UI.** AIO shows **link cards** and references inline with the narrative; **Search Console** attributes traffic from these experiences under **Web** search type (see Google’s reporting docs linked from the same hub).[^g-sc-ai]

**Documented “penalties.”** **Nosnippet / paywall** controls can limit *snippets*; AIO is still an AI *summary* surface—if preview text is limited, *appearance* can change, but the exact AIO *selection* algorithm remains **proprietary**.[^g-sc-ai]

**Reverse-engineering.** **Otterly** and agency posts compare **AIO** vs. other engines’ **citation mix**; **Tow Center** work on **citation *accuracy***, noted via aggregators, addresses **fidelity to sources**, not **ranking** mechanics.[^searchsignal-2026]

**“We don’t know.”** The **LLM re-rank** and **safety** filters that pick which of many eligible URLs get **cited in the paragraph** (versus merely retrieved) are **not** published in formula form.

---

## 5. Google Gemini (chat + Deep Research)

**Standard Gemini chat (with web / grounding).** The **Gemini API** documents **“Grounding with Google Search”** as an optional tool: the model can **issue Search queries** and return **citations** tied to *grounding* (developer-facing; consumer app behavior aligns at a high level).[^g-grounding] Exact **consumer** routing (when Search vs. other tools fire) is **UI/product** logic, partially opaque.

**Deep Research (product).** The **Google Keyword** / Gemini blog positions Deep Research as **multi-site browsing** with visible **“Sites browsed”** and **export with a works-cited** section.[^blog-dr] This is a **long-horizon, multi-step** pipeline—not a single Search query.

**Signals.** Consumer docs emphasize **broad research** and **iterative planning**; they do not publish a **scoring** function. For **Workspace** users, **Gmail / Drive** may enter the corpus (enterprise path).[^blog-dr]

**Attribution UI.** **Sources** panels, **citations in exported documents** for Deep Research.[^blog-dr]

**“We don’t know.”** Internal **citation de-duplication** and **factual** arbitration between conflicting pages.

---

## 6. Microsoft Copilot (Bing-backed)

**Retrieval architecture.** Public Microsoft documentation for **M365** addresses **Bing** when **public web** is allowed in enterprise policies;** Copilot in Windows / Edge** similarly ties to **Bing** web grounding in consumer experiences. The **Bing** index and **Bing** ranking are the backbone; Copilot’s **synthesis** layer is Microsoft + OpenAI models per product generation.[^ms-learn-copilot] — **Not** fully specified in a single public “Copilot = ranker X then LLM Y” page.

**Signals (secondary synthesis).** Marketing / agency guides claim **Bing rank features + semantic scoring + “unique factual value”** for citation; treat as **heuristic** until Microsoft publishes a **Copilot**-specific **ranking** paper.

**Crawler.** **Bingbot** for the index; **independent of OpenAI’s GPTBot** for training.

**Attribution UI.** **Footnote / link** patterns in the Copilot panes; exact styling varies by surface.

**“We don’t know.”** **Copilot-specific re-rank** after top *k* Bing results.

---

## 7. Anthropic Claude (web on vs. off)

**With web search (consumer).** The **Help Center** states Claude **invokes a search tool** to ground on the **live web**; **“Every response includes citations.”** It also discloses that **image search uses Bing** and links Microsoft’s privacy statement.[^anthropic-web-help]

**Without web search.** Standard **RAG** is **user-provided** documents (API **citations** feature) or org connectors—not automatic web RAG.[^anthropic-citations-api]

**Crawler (training vs. product).** **Anthropic** operates **ClaudeBot**-family crawlers in industry tables;** verify** the latest **Anthropic** `bots` page before compliance work. (Not repeated here as a primary fetch due to time; **do not** rely on stale blog tables alone.)

**“We don’t know.”** The **internal mapping** from Bing results → **allowed URLs** in context for a given plan.

---

## 8. Meta AI (Instagram / WhatsApp / etc.)

**Retrieval architecture (press).** 2024 coverage reports **Meta** integrating **Bing and Google** search results for **real-time** answers in the **Meta AI** assistant across apps.[^meta-bing-google] A separate **Reuters** story says Meta explored **in-house** web crawling to **reduce** reliance on those providers—**roadmap/execution** status in 2026 is **uncertain** for the reader without an official Meta **engineering** post.[^meta-reuters-crawl]

**Signals.** Treated similarly to **Bing+Google** hybrid until Meta publishes a spec; **litigation / licensing** with publishers (outside this note) can affect *what* is safely quoted.

**Crawler UAs for Meta’s own project.** If Meta ships a public **Meta-ExternalAgent** or similar, **read Meta’s** developer / robot docs—**not** guess.

**“We don’t know.”** **Current** split between first-party index vs. Bing/Google for a given **locale / surface** in 2026.

---

## 9. xAI Grok (web + X / live search)

**Retrieval architecture (xAI API docs).** **Web Search** is a **first-class tool**: real-time search and browsing, with optional **domain allow/deny** lists. **Citations** are returned as: (a) **all URLs the agent encountered**, and (b) **inline** `[[N]](url)` markdown; **not every** visited URL is necessarily **referenced** in the final text.[^xai-citations] The **X Search** tool (separate doc class) fetches **posts/threads** from X, making **X-native** data structurally *easy* to cite for Grok.

**Signals (deducible).** **Domain filters** and **X search filters** (handles, time windows) *directly* shape the candidate set—this is rarer in consumer-only products.[^xai-live]

**“We don’t know.”** The **web** search backend (own crawl vs. partner index) is **not** detailed in the **API** pages cited; treat as **opaque** beyond *“tool-mediated retrieval.”*

**Reverse-engineering (accuracy, not selection).** Aggregators reference **Tow Center**-style work where some engines score low on *correct attribution*; separate issue from *which* URL is *attempted* first.[^searchsignal-2026]

---

## 10. Brave Search Summarizer & DuckDuckGo Search Assist (smaller / alternative)

**Brave Summarizer (official).** **Brave** states the Summarizer: (1) **only** uses **Brave Search** web results (not a pure LLM Oracle); (2) uses **three LLM** stages: **answer extraction** from snippets, **classification** (hate, spam, *etc.*), and **paraphrase/summarization** to reduce repetition; (3) **cites provenance** with links; (4) runs on a **large query share** of Brave Search, with a noted **~17%** (early-era blog figure) of queries receiving the **top** summary; (5) is **independent of ChatGPT** backend.[^brave-summarizer]

**DuckDuckGo Search Assist (official).** **Search Assist** “scans the web for relevant content” and “always” links **one or two** sources; a **`DuckAssist` bot** / crawling explainer is cross-linked.[^ddg-search-assist] **Duck.ai** is noted as a separate **chat** surface with **third-party models** (OpenAI, Anthropic, *etc.*).[^ddg-search-assist]

**“We don’t know.”** The **inner scoring** of which **Brave** or **DuckDuckGo** result snippets enter the **LLM** context beyond high-level “classification” (Brave) or “relevance” (DDG) language.

---

## Synthesis: cross-engine themes

### What is consistent (GEO / evidence “universals”)

- **Retrieval + generation, not generation alone** for *fresh* or *disputed* web facts is the norm in **search-integrated** products (Brave, OpenAI, Google, xAI, Perplexity, *etc.*). The **Princeton GEO** paper models GEs as **“generative models + search engine to retrieve documents.”**[^geo-kdd]  
- **Crawl permission gates** (OpenAI **OAI-SearchBot**; `Googlebot`; Perplexity/Anthropic/others) are **prerequisites** to even being *collectible* for many pipelines.[^openai-crawlers][^g-sc-ai]  
- **Provenance UI** (inline, hover, or buttons) is **product-structured**, but **citation *accuracy*** remains empirically weak in third-party *accuracy* studies referenced by **SearchSignal** (e.g. **Tow** work).[^searchsignal-2026]  
- **Publisher licensing** and **lawsuits** (OpenAI, Perplexity, *etc.*) sit **alongside** algorithmic selection—*lawful* use can bias **which text** the model is allowed to **verbatim** or **heavily** lean on, even if ranking code is private.[^openai-launch][^perplexity-tc]

### What varies most (engine-specific levers)

- **Index owner:** Google/YouTube/Search Graph vs. **Bing**-family vs. **independent** (Brave) vs. **X-native** (Grok).  
- **Query orchestration:** **query fan-out** (Google) vs. **user/tool steerable** domain filters (xAI) vs. **multi-round** rewrites (ChatGPT search).[^g-sc-ai][^xai-live][^openai-help-search]  
- **Community vs. brand bias** in *observed* citations: **Otterly** reports **material platform differences**; **one playbook will not map**.[^otterly-2026]  
- **Crawler semantics:** `GPTBot` *training* vs. `OAI-SearchBot` *search* vs. **ChatGPT-User** *may ignore robots* by policy.[^openai-crawlers]

### Single-LLM “oracle” vs. multi-LLM reality ( implications for `llm-seo-lab` )

- **Metrics mismatch:** A **“citation share”** number (if taken from a **referral** or **link** report) is **not** the same as **brand salience** in answers, or **AIO** appearance rate. *SearchSignal* reports **~78% of AI *referrals*** attributed to **ChatGPT** in one 2024–2025 line of work—**this is not** “**71% of all citations in the world**,” and users should decompose KPIs.[^searchsignal-2026]  
- **Sampling bias in evaluation:** If an internal **AEO** tool **simulates** visibility with **one** LLM (or one *retrieval* mock), *systematic* error is likely: **Otterly** and **Princeton GEO** both stress **per-engine** *visibility* and **black-box** systems.[^otterly-2026][^geo-kdd] A robust approach **stratifies** by **(a)** engine, **(b)** *informational vs. YMYL vs. product*, and **(c)** **fresh vs. evergreen** because **re-rankers* differ.  
- **Implication:** Treat **a single LLM** as a **cheap directional probe** only; **ground-truth** for commercial decisions needs **on-platform** checks (or **multi-oracle** ensembles + **crawlability** / **compliance** gates).

### Contrasting pipelines (Mermaid)

```mermaid
flowchart LR
  subgraph A["OpenAI ChatGPT search (simplified)"]
    UQ1[User question] --> RW1[Model query rewrite + multi-round partner queries]
    RW1 --> TP[Third-party search + partner data]
    TP --> C1[OAI-SearchBot-discoverable web corpus]
    C1 + TP --> S1[LLM synthesis]
    S1 --> UI1[Inline citations + Sources panel]
  end
  subgraph B["Google AI Overviews (simplified)"]
    UQ2[User query] --> QF[Query fan-out across Search]
    QF --> IDX[Google Search index + snippets eligible pages]
    IDX --> S2[Generative answer + link selection]
    S2 --> UI2[AI Overview w/ link cards]
  end
```

### Master comparison table (best-effort; some cells **opaque**)

| Engine / product | Index / retrieval source (stated) | Refresh cadence | Primary robots / UA (official where known) | Named publisher / data partners (public) |
| --- | --- | --- | --- | --- |
| ChatGPT search | **Third-party search** + **partner** content; OAI-SearchBot for web; fine-tuned GPT-4o family[^openai-launch] | **Search index** (partners) continuous; **~24h** for OAI-SearchBot *robots* updates[^openai-crawlers] | **OAI-SearchBot**, **GPTBot**, **ChatGPT-User** (special rules)[^openai-crawlers] | AP, Axel Springer, FT, Reuters, *etc.* (launch list)[^openai-launch] |
| ChatGPT default (no search) | **Parametric**; optional user/connector context | N/A (no public web index) | **N/A** for RAG; **ChatGPT-User** for user URL fetch[^openai-crawlers] | N/A for web |
| Perplexity | Proprietary **search** + **LLM** (APIs: Sonar / Search)[^perplexity-docs] | “Real-time” (vendor) | **PerplexityBot** (*verify current*)[^otterly-2026] | Publisher program (press)[^perplexity-tc] |
| Google AIO / AI Mode | **Google Search** index + **fan-out**[^g-sc-ai] | Search crawl cadence (continuous) | **Googlebot**; **Google-Extended** (other AI/training; distinct)[^g-sc-ai] | N/A (core Search product) |
| Gemini + DR | **Search** tools + **multi-step** browse (Deep Research)[^blog-dr][^g-grounding] | Session-scale | **Googlebot** (for web *you* do not own) | (Workspace connectors optional) |
| Microsoft Copilot | **Bing** public web in allowed modes[^ms-learn-copilot] | Bing | **Bingbot** | (Microsoft news / MSN ecosystem) |
| Claude + web | **Bing** for images; **search tool** (web)[^anthropic-web-help] | Live | Anthropic **ClaudeBot** family (training; **verify** site) | — |
| Meta AI | **Bing** + **Google** (2024 press)[^meta-bing-google] or evolving | Real-time (claimed) | **TBD** Meta crawler if/when public[^meta-reuters-crawl] | — |
| xAI Grok | **web_search** + **x_search** tools (API)[^xai-citations] | Live / session | (Tool-mediated; *web backend opaque*) | X platform data (structural) |
| Brave Summarizer | **Brave** index only[^brave-summarizer] | Real-time (search QPS) | BraveSearch / Brave (see Brave docs) | — |
| DDG Search Assist | **DuckDuckGo** index scan[^ddg-search-assist] | Crawl as per **DuckAssist** policy | `DuckAssist` bot (see help link)[^ddg-search-assist] | — |

---

## Sources and notes

The footnote keys below are shortened labels used above.

[^openai-crawlers]: OpenAI, “Overview of OpenAI Crawlers,” `https://openai.com/gptbot` (accessed 2026-04-25) — user-agents, IP JSON links, 24h note for searchbot.

[^openai-launch]: OpenAI, “Introducing ChatGPT search” (2024-10-31, updated 2025-02-05), `https://openai.com/index/introducing-chatgpt-search` — model, search partners, publisher quotes and list, distillation note.

[^openai-help-search]: OpenAI Help Center, “ChatGPT search” `https://help.openai.com/en/articles/9237897` — query rewriting, Bing privacy link, location, `Sources` / inline citations, ranking language, OAI-Searchbot requirement.

[^g-sc-ai]: Google Search Central, “AI features and your website” `https://developers.google.com/search/docs/appearance/ai-overviews` — query fan-out, no extra requirements, SEO fundamentals, `Google-Extended` pointer, snippet controls.

[^g-grounding]: Google AI for Developers, “Grounding with Google Search” (Gemini API) `https://ai.google.dev/gemini-api/docs/grounding` (linked from Google developer docs; fetch may time out in some environments—use official mirror).

[^blog-dr]: Google The Keyword, “6 tips to get the most out of Gemini Deep Research” (2025-03-19) `https://blog.google/products/gemini/tips-how-to-use-deep-research/` — “Sites browsed,” exports, Audio Overview, planning.

[^anthropic-web-help]: Anthropic Help Center, “Enabling and using web search” `https://support.anthropic.com/en/articles/10684626` — search tool, citations each response, **Bing** image search, fetch limits for free.

[^xai-live]: xAI, “Web Search” developer guide `https://docs.x.ai/docs/guides/live-search` — tool, domain filters, image understanding.

[^xai-citations]: xAI, “Citations” developer doc `https://docs.x.ai/developers/tools/citations` — all URLs vs. inline, optional disable.

[^brave-summarizer]: Brave, “Brave Search introduces the Summarizer …” (blog) `https://brave.com/blog/ai-summarizer` — three-LLM pipeline, Brave-only results, 17% figure (historic; may now differ), not ChatGPT-powered.

[^ddg-search-assist]: DuckDuckGo Help, “About DuckDuckGo Search Assist” `https://help.duckduckgo.com/duckduckgo-help-pages/results/ai-assisted-answers` — scan web, 1–2 links, `DuckAssist` explainer, Duck.ai.

[^geo-kdd]: Agarwal, Moghaddam, *et al.*, *GEO: Generative Engine Optimization* (KDD 2024; arXiv:2311.09735) `https://arxiv.org/abs/2311.09735` — generative engine definition (search + LLM), black-box, Perplexity evaluation.

[^otterly-2026]: Otterly.AI blog, “The AI Citation Economy …” 2026 report page `https://otterly.ai/blog/the-ai-citations-report-2026` — **commercial** 1M+ citation analysis; **secondary**; claims about crawl barriers and domain share.

[^searchsignal-2026]: SearchSignal, “2026 AI Search Referrals & Citations Benchmark” `https://searchsignal.online/research/ai-search-referrals-citations-2026` — **meta-aggregation**; cites Tow Center and SE Ranking; defines terms.

[^perplexity-tc]: TechCrunch, “Perplexity expands its publisher program” (2024-12-05) `https://techcrunch.com/2024/12/05/perplexity-expands-its-publisher-program/` — **secondary**; named outlets.

[^meta-bing-google]: e.g. MediaPost / TechCrunch 2024 pieces on **Bing+Google** in Meta AI — **secondary**; confirm with **Meta** newsroom for updates.

[^meta-reuters-crawl]: Reuters, “Meta builds AI search engine …” (2024-10-28) `https://www.reuters.com/technology/artificial-intelligence/meta-develops-own-ai-search-engine-cut-reliance-google-bing-information-reports-2024-10-28/` — planning article.

[^verge-bing]: The Verge (2024-10-31) and OpenAI help center linking **Microsoft** privacy for Bing in search.

[^g-ads-note]: For ads in AI experiences, use Google’s **Google Marketing Live** / Ads Help; omitted here for brevity.

[^anthropic-citations-api]: Anthropic, “Citations” (Claude API / docs), `https://docs.anthropic.com/en/docs/build-with-claude/citations` — document-grounded citations, not default web.

[^perplexity-docs]: Perplexity, developer documentation (Search / Sonar APIs), `https://docs.perplexity.ai` — product index architecture only partially specified in public docs.

[^ms-learn-copilot]: Microsoft Learn, “Data, privacy, and security for web search in Microsoft 365 Copilot …” (path may update) `https://learn.microsoft.com/en-us/copilot/microsoft-365/manage-public-web-access` — public web and Bing in enterprise policy context.

---

### Disclosure on numbers in the wild

Market-share, **“citation share,”** and **“visibility”** numbers differ by vendor and metric (referrals vs. links vs. mentions). **This note deliberately avoids** baking in a **single** “~71% / ~63% / …” table unless the **same study** and **metric definition** is attached. The **synthesis** section references **public** figures with clear definitions (**SearchSignal**, **Otterly**).  

**Primary sources counted (approx.):** OpenAI (3), Google Search Central (1), Google Keyword blog (1), xAI (2), Brave (1), DuckDuckGo Help (1), Anthropic Support (1), arXiv GEO (1), + secondary: Otterly, SearchSignal, TechCrunch, Reuters, The Verge line — *≈15 distinct **primary** publisher domains* when counting major vendors once each.
