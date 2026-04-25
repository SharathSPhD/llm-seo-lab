# P1 — `https://www.technektar.dev/` per-site report

**Site type:** Owner portfolio (B2B case studies)
**T0 capture window:** 2026-04-25 (day 0)
**T+14 capture window:** 2026-05-09 (day 14, ± 2 calendar days per `_protocol.md` §5.5)
**Protocol:** `docs/use-cases/_protocol.md` v1.0 (frozen 2026-04-25)

## 1. Site identity

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Primary URL    | https://www.technektar.dev/                                |
| Apex / canonical decision | `https://www.technektar.dev/` (per intervention §5.2) |
| Hosting        | Cloudflare-fronted static site                             |
| Content shape  | 1 home + 6 case-study HTMLs + nav sections (~8 pages)      |
| Owner          | Dr Sharath Sathish                                         |

## 2. Pre-intervention audit summary

Full audit: `docs/research/baseline-audit.md` §`https://technektar.dev/`. The
ten gaps relevant to T0 → T+14 are reproduced here without re-auditing:

1. **Sitemap & robots `Sitemap:` line use placeholder hostnames** (`example.com`,
   `yourdomain.com`) — discovery is structurally broken.
2. **Zero JSON-LD** on homepage and case-study templates.
3. **Aggressive `Disallow: /` on AI/aggregator user-agents** (GPTBot,
   Google-Extended, ClaudeBot, CCBot, Applebot-Extended, Bytespider,
   Amazonbot, meta-externalagent) in `robots.txt`.
4. **Missing Open Graph + Twitter Card** on home and case-study templates.
5. **No canonical** link on `/` vs `/index.html`.
6. **No `og:image`** for case-study templates.
7. `Content-Signal: ai-train=no` set globally — needs intentional decision.
8. No `hreflang` (English-only — accept).
9. Sitemap `lastmod` not automated on deploy.
10. Crawler indexed CSS/favicon as "pages" — limit the next BFS to text/html.

These ten items map directly to the intervention bundle in §5.

## 3. Pre-registered question bank (n = 30)

The bank is constructed from the topical profile in baseline-audit.md
(*"Industrial data science, sCO₂ / energy research leadership, remote
monitoring of rotating equipment, pricing / entropy-based analytics,
ISRO/GE-style high-stakes problem solving"*). All 30 questions are
held constant T0 → T+14.

### 3.1 Brand queries (10)
1. Who is Dr Sharath Sathish?
2. What is technektar.dev?
3. Tell me about Sharath Sathish's work in industrial data science.
4. Who founded TechNektar?
5. Where did Dr Sharath Sathish do his PhD?
6. What companies has Sharath Sathish worked with on supercritical CO2 research?
7. Who leads the EU supercritical CO2 collaboration described on technektar.dev?
8. Tell me about TechNektar's case studies on remote monitoring.
9. What is Sharath Sathish's professional background?
10. Show me the case studies published on technektar.dev.

### 3.2 Topic queries (10)
1. Examples of digital twins for steam turbines.
2. How is supercritical CO2 used in next-generation power cycles?
3. Describe a remote monitoring system for steam turbine fleets.
4. What is information-entropy pricing in industrial B2B?
5. Case study of EU supercritical CO2 research initiative.
6. Best practices for connected critical infrastructure monitoring.
7. Industrial data science case studies for rotating equipment.
8. How do companies apply ML to predictive maintenance for turbines?
9. Walk me through a connected city university energy project.
10. Real-world examples of ISRO-style high-stakes engineering data analysis.

### 3.3 Comparison queries (10)
1. Compare consultants who specialise in industrial AI for energy.
2. Best portfolios for fractional Chief Data Officer in heavy industry.
3. Top remote monitoring case studies in steam turbine literature.
4. Who are leading independent data scientists working on sCO2 power cycles?
5. Compare technektar.dev's case studies to other industrial AI portfolios.
6. Who are alternatives to large consulting firms for energy ML projects?
7. Indie data-science portfolios with documented EU energy work.
8. Compare information-entropy approaches to traditional pricing models.
9. Who publishes verifiable case studies on digital twin deployments?
10. Best independent practitioner portfolios in industrial reliability ML.

The frozen JSON form is committed to
`benchmarks/runs/p7-P1/questions.json` at T0.

## 4. T0 baseline capture protocol

The operator runs the citation oracle from the local Claude Code CLI
worker, exactly once per (engine × question), in the fixed order
declared in `_protocol.md` §2. The exact command is:

```
node packages/cli-worker/dist/cli.js \
  --site P1 \
  --bank docs/use-cases/P1-technektar-dev-report.md \
  --engines perplexity,chatgpt,google_aio,gemini,claude_ai \
  --capture T0 \
  --output benchmarks/runs/p7-P1/T0.jsonl
```

Each event written to `T0.jsonl` is a JSON line of the shape used in
Phase 6:

```
{"qid":"P1-Q01","engine":"perplexity","site_id":"P1","treatment":"baseline","cited":0}
```

`cited = 1` if **any** URL on `technektar.dev` (any subdomain, any
path) is named in the engine's answer or its citation panel; `cited =
0` otherwise. Screenshots are saved alongside each event under
`benchmarks/runs/p7-P1/screenshots/T0/<qid>-<engine>.png` for evidence.

## 5. Intervention bundle

The intervention is a single PR titled `chore(seo): P1 baseline AEO bundle`
that ships **all** of the following before T0 + 1 day so the engines
have ≥ 13 days to reflect the change before T+14:

### 5.1 robots.txt rewrite
- Replace the placeholder `Sitemap:` line with
  `Sitemap: https://www.technektar.dev/sitemap.xml`.
- Remove the wholesale `Disallow: /` for `GPTBot`, `Google-Extended`,
  `ClaudeBot`, `CCBot`, `Applebot-Extended`, `Bytespider`,
  `Amazonbot`, `meta-externalagent`. Replace with `Allow: /` for the
  same agents, **except** `Bytespider` which stays disallowed (low-quality
  crawler, no AEO upside).
- Set `Content-Signal: search=yes, ai-train=yes, ai-input=yes` globally.

### 5.2 sitemap.xml rewrite
- Rewrite all 8 `<loc>` entries from `https://example.com/...` to
  `https://www.technektar.dev/...`.
- Add `<lastmod>` based on the file modification time at deploy.
- Add a build hook so future deploys regenerate `<lastmod>`.

### 5.3 Canonical + OG + Twitter on every page template
- `<link rel="canonical" href="https://www.technektar.dev{path}">` (no
  trailing `index.html`).
- `og:title`, `og:description`, `og:type=article`, `og:url`,
  `og:image=https://www.technektar.dev/assets/og/{slug}.png`.
- `twitter:card=summary_large_image` + matching `twitter:title`,
  `twitter:description`, `twitter:image`.
- One **default** `og:image` (1200×630) for the home and a per-case
  variant for each case study.

### 5.4 JSON-LD on every page
- **Home:** `Person` + `Organization` + `WebSite` blocks. `sameAs`
  array includes `https://technektar.substack.com/`,
  `https://sharathsphd.github.io/`, and any LinkedIn / GitHub URLs the
  owner already publishes.
- **Case studies:** `CreativeWork` (or `TechArticle` where appropriate)
  with `author`, `datePublished`, `dateModified`, `about` (entity URI
  for the technology — e.g. `https://en.wikipedia.org/wiki/Supercritical_carbon_dioxide`
  for sCO2), and `mentions` arrays for the named institutions in
  each story.

### 5.5 Internal linking + canonical-path cleanup
- Resolve `/` vs `/index.html` by issuing a 301 from `/index.html` to
  `/` (Cloudflare Page Rule) and removing internal links to
  `/index.html`.
- Add 1 cross-link from each case study to the relevant Substack post
  (where it exists) using `<a rel="external">` with descriptive anchor
  text, and one back from Substack to the canonical case study (manual
  editorial action on Substack side is tracked in P2's report).

### 5.6 Content brief (one page added)
- Add `https://www.technektar.dev/about/methods.html` — a single
  ~1500-word page that names the entities, vocabularies, and methods
  used across the case studies (sCO2, digital twin, Bayesian state
  estimation, information-entropy pricing). This page exists
  specifically to be quoted by AI engines for the topic queries in §3.2;
  it is the **brief generator** skill's first deliverable for P1.

## 6. T+14 measurement plan

Identical to §4, with `--capture T+14` and output
`benchmarks/runs/p7-P1/T+14.jsonl`. The operator MUST NOT regenerate
the question bank — the same `questions.json` from T0 is loaded by
`packages/cli-worker` to guarantee paired comparison.

## 7. Pre-registered expected effect

From the Phase 6 simulation (`benchmarks/runs/phase6-sim/results.md`),
the calibrated `llm_seo_lab` − `baseline` lift across the 5 engines is:

| Engine     | Phase 6 expected Δ | Phase 6 95% bootstrap CI on Δ |
|------------|--------------------|--------------------------------|
| chatgpt    | +0.056             | [+0.027, +0.085]               |
| claude_ai  | +0.061             | [+0.032, +0.091]               |
| gemini     | +0.062             | [+0.036, +0.089]               |
| google_aio | +0.052             | [+0.021, +0.083]               |
| perplexity | +0.045             | [+0.015, +0.074]               |

These are the pre-registered hypotheses. Per `_protocol.md` §5.4,
n = 30 power for a +5pp Δ at α' = 0.0100 is ≈ 0.06 — small. The
**any-engine** rule is therefore the headline. We additionally
pre-register the **directional** hypothesis: at T+14, the **mean** Δ
across the 5 engines for P1 is `> 0` (one-sample t-test on the per-engine
Δ vector, n = 5). The mean-Δ test has more power against a uniform-lift
alternative even when no individual engine crosses the within-site bar.

## 8. Capture log

| Phase | Date captured | Operator | Channel notes | Events written |
|-------|---------------|----------|---------------|----------------|
| T0    | _pending_     | _pending_| _pending_     | _pending_      |
| T+14  | _pending_     | _pending_| _pending_     | _pending_      |

The operator fills this row at capture time and commits it as a
**separate** commit so the capture history is auditable in `git log`.

## 9. Result

_To be filled in at T+14. Render with:_

```
python3 -m benchmarks.analysis.renderer \
  --events benchmarks/runs/p7-P1/T0.jsonl,benchmarks/runs/p7-P1/T+14.jsonl \
  --output docs/use-cases/P1-technektar-dev-result.md \
  --paired
```

The renderer writes both the per-engine z-test table and the McNemar
paired robustness table per `_protocol.md` §5.3.

## 10. Next-step protocol if verdict is null

If the any-engine rule does not reject **and** the mean-Δ test does not
reject at α = 0.05, the operator triggers the n = 100 follow-on:
expand the per-site bank to 100 questions (90 new questions drawn
from the same brand/topic/comparison split, plus the original 30),
hold the intervention constant, and rerun T0 / T+14 with the new
bank. The follow-on protocol is committed as a new
`_protocol_v2.md` so the original pre-registration remains
auditable.
