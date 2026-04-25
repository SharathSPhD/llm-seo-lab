"""Render a `results.md` (plus committable `summary.json`) from an
`events.jsonl` log.

This is the single source of truth for §11 (Statistical analysis plan) of
methodology.md. The renderer is offline, deterministic, and writes nothing
that is not derivable from the event log.

Two artifacts are produced:
  - `results.md`   — full statistical narrative with ASCII-bar "plots"
  - `summary.json` — small (<10 KB) per-(engine, site, treatment) success
                     count + sample size so the analysis can be reproduced
                     even when the 19 MB `events.jsonl` is gitignored
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Iterable

from benchmarks.analysis.power import required_n_two_proportion
from benchmarks.analysis.stats import (
    bonferroni_correct,
    bootstrap_diff_ci,
    cohens_h,
    mcnemar_test,
    two_proportion_z_test,
)


def _load(events_path: Path) -> list[dict]:
    out: list[dict] = []
    with events_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def _ascii_bar(value: float, max_value: float, width: int = 30) -> str:
    """Render `value` as a left-aligned bar of '█' chars, length proportional to max_value."""
    if max_value <= 0:
        return ""
    n = int(round((value / max_value) * width))
    return "█" * max(0, min(width, n))


def _write_summary_json(
    counts: dict[tuple[str, str, str], tuple[int, int]],
    summary_path: Path,
) -> None:
    payload = {
        "schema_version": 1,
        "by_engine_site_treatment": [
            {
                "engine": engine,
                "site_id": site,
                "treatment": treatment,
                "successes": s,
                "n": n,
                "rate": s / n if n else None,
            }
            for (engine, site, treatment), (s, n) in sorted(counts.items())
        ],
    }
    summary_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _aggregate(
    events: Iterable[dict],
) -> dict[tuple[str, str, str], tuple[int, int]]:
    """Return (engine, site, treatment) -> (successes, n)."""
    counts: dict[tuple[str, str, str], list[int]] = defaultdict(lambda: [0, 0])
    for ev in events:
        key = (ev["engine"], ev["site_id"], ev["treatment"])
        counts[key][0] += int(ev["cited"])
        counts[key][1] += 1
    return {k: (v[0], v[1]) for k, v in counts.items()}


def _paired_discordant(
    events: Iterable[dict],
    engine: str,
    site: str,
    treatment_a: str,
    treatment_b: str,
) -> tuple[int, int]:
    """Return (b, c) discordant pair counts for McNemar.

    `b` = treatment_a cited and treatment_b not; `c` = the reverse.
    Pairing is on `qid`. Multiple sites are not paired together.
    """
    by_q: dict[str, dict[str, int]] = defaultdict(dict)
    for ev in events:
        if ev["engine"] != engine or ev["site_id"] != site:
            continue
        if ev["treatment"] in (treatment_a, treatment_b):
            by_q[ev["qid"]][ev["treatment"]] = int(ev["cited"])
    b = c = 0
    for outcomes in by_q.values():
        if treatment_a not in outcomes or treatment_b not in outcomes:
            continue
        if outcomes[treatment_a] == 1 and outcomes[treatment_b] == 0:
            b += 1
        elif outcomes[treatment_a] == 0 and outcomes[treatment_b] == 1:
            c += 1
    return b, c


def render_results(events_path: Path, output_path: Path) -> Path:
    """Write `results.md` next to `events.jsonl` with the full §11 analysis."""
    events = _load(events_path)
    counts = _aggregate(events)
    engines = sorted({k[0] for k in counts})
    sites = sorted({k[1] for k in counts})
    treatments = sorted({k[2] for k in counts})

    if "baseline" not in treatments:
        raise ValueError("results renderer requires a 'baseline' treatment")
    if "llm_seo_lab" not in treatments:
        raise ValueError("results renderer requires an 'llm_seo_lab' treatment")

    n_questions = max(n for _, n in counts.values())
    site_for_treatment = {
        "baseline": "S4",
        "athenahq_style": "S5",
        "profound_style": "S6",
        "llm_seo_lab": "S1",
    }

    lines: list[str] = []
    lines.append("# Phase 6 Benchmark Results\n")
    lines.append(
        "_Generated automatically by `benchmarks.analysis.renderer.render_results`."
        " Do not edit by hand — re-run the harness instead._\n"
    )
    lines.append("## Pre-registration\n")
    lines.append(
        "See [`docs/benchmarks/methodology.md`](../../docs/benchmarks/methodology.md). "
        "The numbers below are derived **exclusively** from `events.jsonl`.\n"
    )

    n_req = required_n_two_proportion(0.20, 0.25, alpha=0.05 / len(engines), power=0.80)
    lines.append("## Sample-size sanity check\n")
    lines.append(
        f"Per arm: {n_questions} questions. "
        f"Bonferroni-corrected requirement (α' = {0.05 / len(engines):.4f}, "
        f"power 0.80, MDE 5pp): n ≥ {n_req.n_per_arm}.\n"
    )

    lines.append("## Per-engine headline contrast (`llm_seo_lab` vs `baseline`)\n")
    lines.append(
        "| Engine | n | p_baseline | p_llm_seo_lab | Δ | z | p (one-sided, raw) | "
        "Cohen's h | 95% bootstrap CI on Δ |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---|")

    raw_tests = []
    for engine in engines:
        b_succ, b_n = counts[(engine, site_for_treatment["baseline"], "baseline")]
        t_succ, t_n = counts[(engine, site_for_treatment["llm_seo_lab"], "llm_seo_lab")]
        test = two_proportion_z_test(t_succ, t_n, b_succ, b_n, alpha=0.05)
        raw_tests.append(test)
        h = cohens_h(test.p0, test.p1)
        ci = bootstrap_diff_ci(t_succ, t_n, b_succ, b_n, n_resamples=2000, seed=42)
        lines.append(
            f"| {engine} | {b_n} | {test.p0:.3f} | {test.p1:.3f} | "
            f"{test.p1 - test.p0:+.3f} | {test.z:.2f} | {test.p_value_one_sided:.4f} | "
            f"{h.h:.3f} | [{ci.ci_lower:+.3f}, {ci.ci_upper:+.3f}] |"
        )

    lines.append("\n### Headline Δ visualised\n")
    lines.append("```")
    max_delta = max((t.p1 - t.p0) for t in raw_tests) if raw_tests else 0.0
    for engine, t in zip(engines, raw_tests):
        delta = t.p1 - t.p0
        lines.append(f"{engine:>11}  {_ascii_bar(delta, max_delta):<30}  Δ = {delta:+.3f}")
    lines.append("```\n")

    corrected = bonferroni_correct(raw_tests, family_alpha=0.05)
    lines.append("## Bonferroni-corrected significance\n")
    lines.append(f"Family α = 0.05, K = {len(engines)} engines → α' = {corrected[0].alpha:.4f}.\n")
    lines.append("| Engine | p (one-sided) | Significant at α' |")
    lines.append("|---|---:|:---:|")
    for engine, t in zip(engines, corrected):
        lines.append(
            f"| {engine} | {t.p_value_one_sided:.4f} | {'Yes' if t.significant else 'No'} |"
        )

    lines.append("\n## Robustness: McNemar paired test on the same site\n")
    lines.append(
        "For each engine we recompute the headline contrast on the matched-question pairs "
        "for site `S1` (`llm_seo_lab` arm vs the `baseline` arm applied to the same site). "
        "Per methodology.md §11(3), this is a two-sided exact test; we expect any engine "
        "where the unpaired one-sided z-test rejects to also reject here at the same α', "
        "confirming the parallel-groups approximation is not the source of the effect.\n"
    )
    lines.append("| Engine | discordant b | discordant c | McNemar p (two-sided) |")
    lines.append("|---|---:|---:|---:|")
    for engine in engines:
        b, c = _paired_discordant(events, engine, "S1", "llm_seo_lab", "baseline")
        p = mcnemar_test(b, c)
        lines.append(f"| {engine} | {b} | {c} | {p:.4g} |")

    lines.append("\n## Secondary contrasts (`llm_seo_lab` vs SOTA-style monitoring)\n")
    for sota in ("athenahq_style", "profound_style"):
        lines.append(f"\n### vs `{sota}`\n")
        lines.append("| Engine | p_sota | p_llm_seo_lab | Δ | z | p (one-sided) |")
        lines.append("|---|---:|---:|---:|---:|---:|")
        for engine in engines:
            s_succ, s_n = counts[(engine, site_for_treatment[sota], sota)]
            t_succ, t_n = counts[(engine, site_for_treatment["llm_seo_lab"], "llm_seo_lab")]
            test = two_proportion_z_test(t_succ, t_n, s_succ, s_n, alpha=0.05)
            lines.append(
                f"| {engine} | {test.p0:.3f} | {test.p1:.3f} | "
                f"{test.p1 - test.p0:+.3f} | {test.z:.2f} | {test.p_value_one_sided:.4f} |"
            )

    lines.append("\n## Reproducibility\n")
    try:
        ev_display = events_path.relative_to(Path.cwd())
    except ValueError:
        ev_display = events_path
    lines.append(
        f"- Events: `{ev_display}`\n"
        f"- Engines × treatments × sites × questions = "
        f"{len(engines)} × {len(treatments)} × {len(sites)} × {n_questions} = "
        f"{len(engines) * len(treatments) * len(sites) * n_questions:,} draws\n"
        "- Re-run with `python3 -m benchmarks.runner.cli` to regenerate.\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")

    summary_path = output_path.with_name("summary.json")
    _write_summary_json(counts, summary_path)
    return output_path
