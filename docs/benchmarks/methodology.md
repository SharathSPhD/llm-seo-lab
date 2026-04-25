# Benchmark Methodology — `llm-seo-lab` vs SOTA AEO Tools

> Phase 6 deliverable. This document is the **pre-registration** of the experiment.
> No results live here — those go to [`results.md`](results.md). All sections must
> be in place **before** any measurement is recorded so the design is falsifiable
> and the analysis cannot be tuned to the data.

## 1. Research question

Does the closed-loop intervention shipped by `llm-seo-lab` ("audit → brief → PR
→ merge") increase **AI citation share** more than monitoring-only SOTA tools
(AthenaHQ-style, Profound-style) or no intervention at all, holding the site
and time window constant?

## 2. Hypotheses

For each AI engine $e \in \{\text{Perplexity}, \text{ChatGPT}, \text{Google AIO}, \text{Gemini}, \text{Claude.ai}\}$
and each treatment $t \in \{\text{baseline}, \text{athenahq\_style}, \text{profound\_style}, \text{llm\_seo\_lab}\}$,
let $p_{e,t}$ be the probability that the site is cited in a response sampled
from the question bank.

- $H_{0,e}: p_{e,\text{llm\_seo\_lab}} = p_{e,\text{baseline}}$
- $H_{1,e}: p_{e,\text{llm\_seo\_lab}} > p_{e,\text{baseline}}$

Secondary contrasts (registered but not headline):

- $p_{e,\text{llm\_seo\_lab}} > p_{e,\text{athenahq\_style}}$
- $p_{e,\text{llm\_seo\_lab}} > p_{e,\text{profound\_style}}$

## 3. Primary outcome

**Citation share** at $T = 30$ days post-intervention, defined per engine as

$$
\hat{p}_{e,t} = \frac{1}{N} \sum_{i=1}^{N} \mathbf{1}\{\text{site URL appears in citations of engine } e \text{ for question } q_i\}
$$

where $N$ is the size of the question bank and $\mathbf{1}\{\cdot\}$ is the indicator.

A "citation" is the literal substring of the site domain (or any subdomain) in
the engine's structured `citations` / `sources` field. We **do not** count plain
text mentions without an attached link, to keep the measurement adversary-resistant.

## 4. Question bank

- $N = 1500$ synthetic-but-realistic buyer questions, generated deterministically
  from the seed listed in [`benchmarks/questions/seeds.json`](../../benchmarks/questions/seeds.json).
  We chose $N = 1500$ rather than the round-number $N = 1000$ favored by
  AthenaHQ-style harnesses because the Bonferroni-corrected primary contrast
  (§8) requires $n \gtrsim 1325$ per arm to retain 80% power.
- Four categories, $375$ questions each:
  1. **Comparison** — "X vs Y" / "X or Y, which is better"
  2. **Recommendation** — "best X for Y" / "what tool should I use"
  3. **How-to** — "how do I X" / "steps to X"
  4. **Definition** — "what is X" / "explain X"
- Each category covers the same 50 topical seeds drawn from the validation
  cohort's Substack archive and competitor coverage matrix.
- The bank is fixed at experiment start; questions cannot be added or removed
  during the run. Ordering within the bank is the only random element across
  treatments and is shared across treatments to enable paired analysis.

## 5. Treatment definitions

| Treatment | Description | Implementation |
|---|---|---|
| `baseline` | No intervention. Site is left as-is. | `benchmarks/treatments/baseline.py` |
| `athenahq_style` | Only the recommendations a monitoring dashboard would surface (gap list, no autonomous action). | `benchmarks/treatments/athenahq_style.py` |
| `profound_style` | Same as above plus a managed-services brief draft delivered out-of-band. | `benchmarks/treatments/profound_style.py` |
| `llm_seo_lab` | Full closed loop: audit → brief → PR → merge. | `benchmarks/treatments/llm_seo_lab.py` |

All treatments operate on the **same site cohort** within a 24h window so they
share macro-level confounders (engine model updates, news cycles).

## 6. Site cohort

| Slot | Site | Role |
|---|---|---|
| `S1` | `technektar.dev` | Treated (`llm_seo_lab`) |
| `S2` | `technektar.substack.com` | Treated (`llm_seo_lab`) |
| `S3` | A SharathSPhD GitHub Pages site (URL confirmed Phase 7) | Treated (`llm_seo_lab`) |
| `S4` | An untouched indie site of comparable size | Control (`baseline`) |
| `S5` | Indie site receiving `athenahq_style` only | Treated |
| `S6` | Indie site receiving `profound_style` only | Treated |

`S5` and `S6` are confirmed in Phase 7. The 1-control + 3-treated headline
ratio (per the implementation plan) refers to `S4` versus `{S1, S2, S3}` for
the primary contrast.

## 7. Measurement engines

| Engine | Mechanism | Adapter |
|---|---|---|
| Perplexity | Playwright on the public chat UI (consented session) | `benchmarks/engines/perplexity.py` |
| ChatGPT | Playwright on the public chat UI (consented session) | `benchmarks/engines/chatgpt.py` |
| Google AIO | Playwright on the SERP page | `benchmarks/engines/google_aio.py` |
| Gemini | Playwright on the public Gemini UI | `benchmarks/engines/gemini.py` |
| Claude.ai | Direct Claude Code CLI (`claude --print`) | `benchmarks/engines/claude_ai.py` |

For Phase 6 (this document), all engines have an offline simulation mode
(`--simulate`) that generates citation events from a documented stochastic
process so the pipeline can be validated end-to-end without burning real-engine
quota.

## 8. Power analysis

Two-proportion z-test, equal-allocation, one-sided $\alpha = 0.05$, target
power $1 - \beta = 0.80$, baseline citation share $p_0 = 0.20$ (median of
SerpRecon / SearchFit baseline reports for indie sites in 2026), minimum
detectable effect $\Delta = 0.05$ (5 percentage points).

Required sample size per arm (two-proportion normal approximation):

$$
n \geq \frac{\left( z_{1-\alpha} \sqrt{2 \bar{p} (1 - \bar{p})} + z_{1-\beta} \sqrt{p_0 (1 - p_0) + p_1 (1 - p_1)} \right)^2}{\Delta^2}
$$

with $p_1 = p_0 + \Delta$ and $\bar{p} = (p_0 + p_1) / 2$.

Plugging in numbers (computed exactly in
[`benchmarks/analysis/power.py`](../../benchmarks/analysis/power.py) and
verified by the unit tests in
[`benchmarks/analysis/stats_test.py`](../../benchmarks/analysis/stats_test.py)):

```
unadjusted (α = 0.05, one-sided): n ≥ 862 per arm
Bonferroni K=5 engines (α' = 0.0100, one-sided): n ≥ 1399 per arm
```

We choose $N = 1500$ per arm. This gives:

- $\approx 83\%$ power against the registered $\Delta = 0.05$ MDE under the
  Bonferroni-corrected $\alpha' = 0.0100$;
- $\approx 95\%$ power against the same MDE at the unadjusted $\alpha = 0.05$
  used for the secondary `athenahq_style` and `profound_style` contrasts;
- $\approx 63\%$ power against the smaller secondary $\Delta = 0.04$ MDE
  under Bonferroni — explicitly acknowledged as underpowered for that
  ancillary effect size.

We deliberately do not chase 95% headline power because each additional
percentage point of power costs hundreds of engine queries against rate-limited
public chat UIs. $N = 1500$ is the smallest design that keeps the *primary*
Bonferroni-corrected contrast above 80% power.

## 9. Randomization

- **Within-treatment**: questions are presented in a permuted order, seeded
  per-engine, to avoid temporal confounding from rate-limited adapters.
- **Across-treatment**: the same question bank is reused across treatments —
  this is a paired design, not a parallel-groups design. The primary contrast
  uses **McNemar's test** as a robustness check against the unpaired
  two-proportion z-test.
- **Across-engine**: engines are run in randomized order per question to
  minimize correlated session-level effects.

## 10. Blinding

- The engine adapters do not receive any signal about which treatment is
  active.
- The analysis script does not see treatment labels until after the citation
  detector has produced its event log; the labels are joined post-hoc from
  `treatment.jsonl`.
- No blinding of the operator who applies treatments — that is structurally
  impossible for an unsupervised research project, and is documented as a
  limitation.

## 11. Statistical analysis plan

1. **Primary contrast**: two-proportion z-test, one-sided, $\alpha = 0.05$,
   for each of the 5 measurement engines and the headline `llm_seo_lab` vs
   `baseline` arm.
2. **Multiplicity**: Bonferroni-correct across the 5 engines ($\alpha' = 0.0100$)
   for the headline claim. The 95% CI reported per engine uses the corrected $\alpha'$.
   Claude.ai is included in the family because the product runs Claude Code CLI
   as its primary oracle — holding it to the same multiplicity-adjusted bar as
   the third-party engines is the conservative choice.
3. **Robustness check**: McNemar's test on the paired-question design (treatment
   `llm_seo_lab` vs `baseline` measured on site `S1`). The McNemar p-value is
   reported but not used for the headline claim — it is two-sided whereas the
   primary z-test is one-sided, so the two are not directly comparable. A
   McNemar p $< \alpha'$ wherever the z-test rejects is sufficient to confirm
   the parallel-groups approximation is not the source of any apparent effect.
4. **Confidence intervals**: bootstrap percentile intervals for $\hat{p}_{e,t}$
   and for the difference $\hat{p}_{e,t} - \hat{p}_{e,\text{baseline}}$, with
   $B = 10{,}000$ resamples, paired across questions where applicable.
5. **Effect size**: Cohen's $h = 2 \arcsin(\sqrt{p_1}) - 2 \arcsin(\sqrt{p_0})$
   reported per engine.
6. **Secondary contrasts**: same as primary, applied to the
   `athenahq_style` and `profound_style` arms. These are reported but not
   counted toward the headline multiplicity correction.

## 12. Stopping rules

- The benchmark is **not** an adaptive trial. We do not look at $p$-values
  during the run. The full $N = 1000$ questions per arm are collected before
  any analysis.
- A treatment arm is **truncated** if more than 25% of its questions return
  an `ENGINE_ERROR` from the adapter (e.g. captcha, ban). Truncation is
  reported as a limitation rather than as a result.
- The control site (`S4`) is monitored for *natural* citation share drift; if
  $|\hat{p}_{e,\text{baseline,T+30}} - \hat{p}_{e,\text{baseline,T+0}}| > 0.10$
  on any engine, we report it but do not adjust the headline contrast (we
  preserve the pre-registered analysis).

## 13. Reproducibility

- All questions, treatment plans, engine logs, and analysis outputs are
  committed under `benchmarks/runs/<run-id>/`.
- Each run-id directory contains a `manifest.json` with seed, git SHA at
  start, and adapter version pins.
- `make benchmark-replay RUN=<run-id>` re-runs the full statistical pipeline
  on the saved JSONL events without touching live engines, and asserts
  bit-identical numbers in `results.md`.

## 14. Limitations (declared up-front)

- Public-UI scraping for Perplexity, ChatGPT, Google AIO, and Gemini is on
  the boundary of the engines' terms of service. We use **only consented
  user sessions** (the operator's own logged-in accounts), restrict the rate
  to one query per 8s per engine, and never resell the data.
- The validation cohort is small (3 treated indie sites + 1 control). The
  $N = 1000$ question bank gives the statistical power; the **external
  validity** is bounded by the cohort. We do not generalize beyond
  indie-scale sites in the headline.
- Phase 6 results in `results.md` use the offline simulation; Phase 7
  re-runs the same pipeline with live engines on the real cohort and
  produces the published numbers.

## 15. Pre-registration freeze

This document is frozen at git SHA recorded in
`benchmarks/runs/<run-id>/manifest.json`. Any change to hypothesis,
sample size, or analysis plan after the freeze must be filed as an
**amendment** in this section with a dated rationale, and the affected
results re-run from raw events.

| Date | Change | Rationale |
|---|---|---|
| 2026-04-25 | Initial pre-registration | n/a |
