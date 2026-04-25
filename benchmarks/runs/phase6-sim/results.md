# Phase 6 Benchmark Results

_Generated automatically by `benchmarks.analysis.renderer.render_results`. Do not edit by hand — re-run the harness instead._

## Pre-registration

See [`docs/benchmarks/methodology.md`](../../docs/benchmarks/methodology.md). The numbers below are derived **exclusively** from `events.jsonl`.

## Sample-size sanity check

Per arm: 1500 questions. Bonferroni-corrected requirement (α' = 0.0100, power 0.80, MDE 5pp): n ≥ 1399.

## Per-engine headline contrast (`llm_seo_lab` vs `baseline`)

| Engine | n | p_baseline | p_llm_seo_lab | Δ | z | p (one-sided, raw) | Cohen's h | 95% bootstrap CI on Δ |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| chatgpt | 1500 | 0.192 | 0.248 | +0.056 | 3.70 | 0.0001 | 0.135 | [+0.027, +0.085] |
| claude_ai | 1500 | 0.190 | 0.251 | +0.061 | 4.05 | 0.0000 | 0.148 | [+0.032, +0.091] |
| gemini | 1500 | 0.149 | 0.211 | +0.062 | 4.42 | 0.0000 | 0.162 | [+0.036, +0.089] |
| google_aio | 1500 | 0.226 | 0.278 | +0.052 | 3.28 | 0.0005 | 0.120 | [+0.021, +0.083] |
| perplexity | 1500 | 0.207 | 0.252 | +0.045 | 2.91 | 0.0018 | 0.106 | [+0.015, +0.074] |

### Headline Δ visualised

```
    chatgpt  ███████████████████████████     Δ = +0.056
  claude_ai  ██████████████████████████████  Δ = +0.061
     gemini  ██████████████████████████████  Δ = +0.062
 google_aio  █████████████████████████       Δ = +0.052
 perplexity  ██████████████████████          Δ = +0.045
```

## Bonferroni-corrected significance

Family α = 0.05, K = 5 engines → α' = 0.0100.

| Engine | p (one-sided) | Significant at α' |
|---|---:|:---:|
| chatgpt | 0.0001 | Yes |
| claude_ai | 0.0000 | Yes |
| gemini | 0.0000 | Yes |
| google_aio | 0.0005 | Yes |
| perplexity | 0.0018 | Yes |

## Robustness: McNemar paired test on the same site

For each engine we recompute the headline contrast on the matched-question pairs for site `S1` (`llm_seo_lab` arm vs the `baseline` arm applied to the same site). Per methodology.md §11(3), this is a two-sided exact test; we expect any engine where the unpaired one-sided z-test rejects to also reject here at the same α', confirming the parallel-groups approximation is not the source of the effect.

| Engine | discordant b | discordant c | McNemar p (two-sided) |
|---|---:|---:|---:|
| chatgpt | 308 | 195 | 5.331e-07 |
| claude_ai | 301 | 238 | 0.007516 |
| gemini | 265 | 191 | 0.0006142 |
| google_aio | 326 | 234 | 0.0001165 |
| perplexity | 308 | 210 | 1.921e-05 |

## Secondary contrasts (`llm_seo_lab` vs SOTA-style monitoring)


### vs `athenahq_style`

| Engine | p_sota | p_llm_seo_lab | Δ | z | p (one-sided) |
|---|---:|---:|---:|---:|---:|
| chatgpt | 0.187 | 0.248 | +0.061 | 4.07 | 0.0000 |
| claude_ai | 0.199 | 0.251 | +0.053 | 3.45 | 0.0003 |
| gemini | 0.161 | 0.211 | +0.050 | 3.52 | 0.0002 |
| google_aio | 0.241 | 0.278 | +0.037 | 2.29 | 0.0110 |
| perplexity | 0.218 | 0.252 | +0.034 | 2.20 | 0.0140 |

### vs `profound_style`

| Engine | p_sota | p_llm_seo_lab | Δ | z | p (one-sided) |
|---|---:|---:|---:|---:|---:|
| chatgpt | 0.211 | 0.248 | +0.037 | 2.39 | 0.0085 |
| claude_ai | 0.201 | 0.251 | +0.051 | 3.32 | 0.0005 |
| gemini | 0.172 | 0.211 | +0.039 | 2.74 | 0.0031 |
| google_aio | 0.228 | 0.278 | +0.050 | 3.15 | 0.0008 |
| perplexity | 0.223 | 0.252 | +0.029 | 1.84 | 0.0326 |

## Reproducibility

- Events: `benchmarks/runs/phase6-sim/events.jsonl`
- Engines × treatments × sites × questions = 5 × 4 × 6 × 1500 = 180,000 draws
- Re-run with `python3 -m benchmarks.runner.cli` to regenerate.
