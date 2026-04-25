# Phase 7 — Real-Site Measurement Protocol

**Status:** Pre-registered, frozen 2026-04-25. Any change to this file
between T0 and T+14 invalidates the run for the affected site and must
re-trigger T0 capture.

This file is the shared protocol that every per-site report
(`<site>-report.md`) inherits by reference. Per-site reports MAY add
local question banks, intervention diffs, and a per-site analysis
table, but MUST NOT redefine the statistics, the engines, the alpha
budget, or the success criterion.

---

## 1. Sites in the cohort

| ID | URL                                                                  | Type                  | Audit source |
|----|----------------------------------------------------------------------|-----------------------|--------------|
| P1 | https://www.technektar.dev/                                          | Owner portfolio       | `docs/research/baseline-audit.md` §technektar.dev |
| P2 | https://technektar.substack.com/                                     | Substack publication  | `docs/research/baseline-audit.md` §substack |
| P3 | https://sharathsphd.github.io/                                       | Personal Jekyll blog  | `docs/research/baseline-audit.md` §github.io |
| P4 | https://sharathsphd.github.io/context-engineering-harness/           | Indie OSS docs site   | This protocol §6 (fresh audit) |
| P5 | https://sharathsphd.github.io/attractor-flow-plugin-bench/           | Indie OSS bench site  | This protocol §6 (fresh audit) |

Each site is treated as an **independent** experiment with its own
T0 and its own T+14. There is no cross-site pooling because the
content surface, audience, and intervention vary by site. Family-wise
correction is therefore applied **within** a site (across the 5 engines)
and **not** across sites.

## 2. Engines under measurement (K = 5)

Same five engines as Phase 6, queried in this fixed order to match the
benchmark schema:

1. `perplexity` (Perplexity public surface)
2. `chatgpt` (ChatGPT search surface)
3. `google_aio` (Google AI Overviews)
4. `gemini` (Gemini consumer surface)
5. `claude_ai` (Claude.ai web surface)

The query channel is the **hybrid citation oracle** defined in
`docs/spec/mcp-design.md` §oracle_query: the local Claude Code CLI as
primary oracle, Playwright fallback via `cursor-ide-browser` MCP for
public chat surfaces, and manual screenshot ingestion as evidence layer
when neither route is available. The choice of channel for each engine
is recorded in the per-site report's measurement-channel table.

## 3. Per-site question bank (n = 30)

Each site declares a **30-question** topical bank. The bank is held
constant across T0 and T+14; an engine answer that cites *any* page
under the site's primary domain (or a designated subpath, in P4/P5) is
counted as `cited = 1`. The 30-question floor was chosen so that the
within-site Bonferroni-corrected per-engine test has at least
moderate power for the Phase 6 effect size; see §5.

Questions are constructed from three slots in equal proportion (10 each):

- **brand-queries** — questions where a buyer/researcher asks for the
  author or the project by name (e.g. *"who is Dr Sharath Sathish"*).
- **topic-queries** — questions about the topical territory the site
  legitimately owns (e.g. *"supercritical CO₂ research collaboration in
  the EU"* for P1, *"darśana-śāstra applied to LLM context windows"* for
  P4).
- **comparison-queries** — buyer-style comparison questions where the
  site is one plausible source among several (e.g. *"how does the
  attractor-flow plugin compare to other regime-detection toolkits"* for
  P5). These are the hardest cell and are the primary battleground for
  the `llm_seo_lab` treatment.

The per-site bank is frozen at T0 and committed to the repository under
`benchmarks/runs/p7-<site-id>/questions.json`.

## 4. Treatment definition

For Phase 7 there are exactly two arms per site:

- **`baseline`** — the state of the site at T0, *before* the intervention
  bundle declared in the per-site report has been applied. T0
  measurement happens against this arm.
- **`llm_seo_lab`** — the state of the site **at T+14**, after the full
  intervention bundle has been merged into the production deployment.

Phase 7 does not include the `athenahq_style` or `profound_style` arms
that were used in Phase 6 — those arms compare *vendor playbooks* to
the `llm_seo_lab` arm and require parallel sites, which is an
explicit non-goal in Phase 7 (we are not buying competitor licences).
The Phase 6 result is the cross-tool contrast; Phase 7 is the
within-site time-series contrast.

## 5. Statistical analysis plan

### 5.1 Primary test (per engine, one-sided)

For each of the K = 5 engines we form the **2 × 2** table

|              | cited | not cited |
|--------------|-------|-----------|
| T0           |  c0   |  n − c0   |
| T+14         |  c1   |  n − c1   |

with `n = 30` per cell, and run a **two-proportion z-test** for the
one-sided alternative `H₁: p_{T+14} > p_{T0}` exactly as implemented in
`benchmarks/analysis/stats.py::two_proportion_z_test`. The
**within-site Bonferroni** alpha is

```
α' = 0.05 / 5 = 0.0100
```

A site is declared a **success** for an engine if `p_value_one_sided <
α'`. We additionally require **Cohen's h ≥ 0.10** (a small effect by
Cohen 1988 conventions) so that statistically-significant micro-effects
on a small denominator do not count as material.

### 5.2 Aggregate site verdict

A site is declared a **site-level success** iff **at least one** of the
5 engine-level tests rejects at α' = 0.0100 *with* h ≥ 0.10. This is the
**any-engine** rule pre-registered here. We also report the
**majority-engine** rule (≥ 3 / 5) for transparency, but the headline
verdict is any-engine because the Phase 6 effect distribution suggests
heterogeneous per-engine response (some engines respond strongly to
schema changes, others to freshness; see `docs/research/citation-mechanisms.md`).

### 5.3 Robustness

**McNemar paired test** is computed on the same 30-question pairs per
engine and reported in each per-site report as a two-sided robustness
check (per `docs/benchmarks/methodology.md` §11(3)). A McNemar p-value
that disagrees with the unpaired z-test triggers a footnote and a
narrative explanation; it does not by itself flip the verdict.

### 5.4 Power on n = 30

We are honest about the small per-cell denominator. For the Phase 6
calibrated effect (`llm_seo_lab` − `baseline` ≈ +5pp on average), the
per-engine power at α' = 0.0100 with n = 30 is ≈ **0.06** by the same
`required_n_two_proportion` calculation used for Phase 6. This is **far
below** the 0.80 power floor used in Phase 6, and is the primary
reason the Phase 7 verdict is **any-engine** rather than majority. A
site that produces a +5pp lift on **every** engine but does not cross
the 1% bar on **any** engine will look null under the strict Bonferroni
rule; in that case we report the directional pattern, the per-engine
**95% bootstrap CI on Δ**, and a follow-on protocol with n = 100 per
cell (rather than declare the intervention failed). This rule is
pre-registered to protect against the very small-n trap.

### 5.5 No early stopping

Each site collects the full T0 cell on day 0 and the full T+14 cell on
day 14. There is no peeking, no early stop, no spending function, and
no inflation of α'. If a site cannot finish T+14 within day-14 ± 2
calendar days (e.g. propagation lag in a search index), the site's
T+14 cell is held until it can complete, and the analysis date is
shifted to the actual T+14 capture date — this fact is recorded in the
per-site report's "Capture log."

## 6. Fresh audit data: P4 and P5 (recorded for the first time here)

Sites P1–P3 are audited in `docs/research/baseline-audit.md`. The two
indie sites added in Phase 7 are not, so their head-level audit is
recorded here so per-site reports can cite a single source.

### P4 — `https://sharathsphd.github.io/context-engineering-harness/`

Fetched 2026-04-25.

- HTTP 200; `Last-Modified: Tue, 21 Apr 2026 12:34:53 GMT`.
- HTML size **74,875 bytes**; **0** `<script>` tags inline; **0**
  `application/ld+json` blocks.
- Head meta is unusually **strong** for a hand-rolled GitHub Pages site:
  `<title>` is descriptive (*"When the Context Window Is Big and the
  Agent Is Still Confused — Pratyakṣa"*), the `meta description` is a
  full-sentence pitch, all four Open Graph properties are present
  (`og:type=article`, `og:title`, `og:description`,
  `og:image=…/lostmiddle.png`, `og:url`), and `twitter:card` is
  `summary_large_image` with matching image.
- **External authority anchor:** the page links to a Zenodo DOI
  (`https://zenodo.org/records/19653013`) — a real citable preprint
  record for the canonical v2.0 release. This is rare for a personal
  GitHub Pages property and is a meaningful AEO asset.
- No JSON-LD; no FAQ schema; no `Article` schema; no `dateModified` in
  any structured form. Sitemap and robots.txt are inherited from the
  user-site (`https://sharathsphd.github.io/sitemap.xml` /
  `…/robots.txt`) and **do not list** the project subpath
  `/context-engineering-harness/` — discovery for the page therefore
  depends on the in-page navigation and external links rather than the
  user-site sitemap.

### P5 — `https://sharathsphd.github.io/attractor-flow-plugin-bench/`

Fetched 2026-04-25.

- HTTP 200; `Last-Modified: Sat, 28 Mar 2026 23:01:58 GMT`.
- HTML size **268,352 bytes**; **7** `<script>` tags inline (chart and
  table renderers); **0** `application/ld+json` blocks.
- Head meta is **weak**: `<title>` only (*"EvolveSys × AttractorFlow —
  5-Cycle Benchmark"*); **no** `meta description`; **no** Open Graph;
  **no** Twitter card; **no** canonical link. This is the textbook
  case of a research-grade content surface (a benchmark with charts,
  tables, and methodology notes) that an AI engine has almost no
  metadata to reason about.
- Same inherited sitemap/robots as P4.

These two sites are deliberately the **scrappy** end of the cohort —
the report shape is meant to make the contrast between an
already-strong-meta property (P4) and a meta-bare property (P5) visible
under the *same* intervention bundle.

---

## 7. Per-site report file template

Each per-site report uses this exact section ordering so they can be
diffed against each other and aggregated by `tools/aggregate_p7.py`
(future):

1. **Site identity**
2. **Pre-intervention audit summary** (link out, do not duplicate)
3. **Pre-registered question bank** (n = 30, 10/10/10 split)
4. **T0 baseline capture protocol** (operator instructions)
5. **Intervention bundle** (concrete file diffs / CMS edits)
6. **T+14 measurement plan** (identical question bank, identical
   engines, identical channels)
7. **Pre-registered expected effect** (drawn from Phase 6 calibration)
8. **Capture log** (filled in by the operator at T0 and T+14)
9. **Result** (filled in at T+14: per-engine table, McNemar, verdict)
10. **Next-step protocol** if the verdict is null (n = 100 follow-on)

The reports are committed to `docs/use-cases/<P_id>-<slug>-report.md`.
T0 / T+14 captures are committed to `benchmarks/runs/p7-<P_id>/`.

---

*End of protocol. Frozen 2026-04-25. Any change requires a new file
`_protocol_v2.md` and a re-trigger of T0 for affected sites.*
