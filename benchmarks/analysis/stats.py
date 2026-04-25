"""Two-proportion z-test, Bonferroni, bootstrap CI, Cohen's h, McNemar.

Pure Python, no NumPy/SciPy dependency. The benchmark harness must run on a
fresh checkout with only `python3 -m venv .venv && pip install -e .`, so we
keep dependencies to standard-library only. Numerical accuracy is tested in
`benchmarks/analysis/stats.test.py` against hand-computed values.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class TwoProportionTest:
    p0: float
    p1: float
    n0: int
    n1: int
    z: float
    p_value_one_sided: float
    p_value_two_sided: float
    alpha: float
    significant: bool


@dataclass(frozen=True)
class BootstrapResult:
    point: float
    ci_lower: float
    ci_upper: float
    alpha: float
    n_resamples: int


@dataclass(frozen=True)
class CohensH:
    p0: float
    p1: float
    h: float


def _phi(z: float) -> float:
    """Standard normal CDF using erf."""
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def two_proportion_z_test(
    successes_treatment: int,
    n_treatment: int,
    successes_control: int,
    n_control: int,
    alpha: float = 0.05,
) -> TwoProportionTest:
    """One-sided pooled z-test of H0: p_treatment <= p_control.

    Returns the z statistic, both one-sided and two-sided p-values, and a
    boolean for the (one-sided) significance at the supplied alpha.
    """
    if n_treatment <= 0 or n_control <= 0:
        raise ValueError("n must be > 0")
    p1 = successes_treatment / n_treatment
    p0 = successes_control / n_control
    p_pool = (successes_treatment + successes_control) / (n_treatment + n_control)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_treatment + 1 / n_control))
    if se == 0:
        z = 0.0
    else:
        z = (p1 - p0) / se
    p_one_sided = 1 - _phi(z)
    p_two_sided = 2 * (1 - _phi(abs(z)))
    return TwoProportionTest(
        p0=p0,
        p1=p1,
        n0=n_control,
        n1=n_treatment,
        z=z,
        p_value_one_sided=p_one_sided,
        p_value_two_sided=p_two_sided,
        alpha=alpha,
        significant=p_one_sided < alpha,
    )


def bonferroni_correct(
    tests: Sequence[TwoProportionTest],
    family_alpha: float = 0.05,
) -> list[TwoProportionTest]:
    """Re-evaluate `significant` at family_alpha / k.

    Returns a new list with `alpha` and `significant` updated; other fields
    are preserved so caller can audit raw vs corrected.
    """
    if not tests:
        return []
    k = len(tests)
    corrected_alpha = family_alpha / k
    return [
        TwoProportionTest(
            p0=t.p0,
            p1=t.p1,
            n0=t.n0,
            n1=t.n1,
            z=t.z,
            p_value_one_sided=t.p_value_one_sided,
            p_value_two_sided=t.p_value_two_sided,
            alpha=corrected_alpha,
            significant=t.p_value_one_sided < corrected_alpha,
        )
        for t in tests
    ]


def cohens_h(p0: float, p1: float) -> CohensH:
    """Cohen's h: 2 arcsin(sqrt(p1)) - 2 arcsin(sqrt(p0))."""
    if not 0 <= p0 <= 1 or not 0 <= p1 <= 1:
        raise ValueError("proportions must be in [0,1]")
    h = 2 * math.asin(math.sqrt(p1)) - 2 * math.asin(math.sqrt(p0))
    return CohensH(p0=p0, p1=p1, h=h)


def bootstrap_proportion_ci(
    successes: int,
    n: int,
    alpha: float = 0.05,
    n_resamples: int = 10_000,
    seed: int = 42,
) -> BootstrapResult:
    """Percentile bootstrap CI for a single proportion."""
    if n <= 0:
        raise ValueError("n must be > 0")
    rng = random.Random(seed)
    point = successes / n
    samples: list[float] = []
    for _ in range(n_resamples):
        s = sum(1 for _ in range(n) if rng.random() < point)
        samples.append(s / n)
    samples.sort()
    lo = samples[int((alpha / 2) * n_resamples)]
    hi = samples[int((1 - alpha / 2) * n_resamples)]
    return BootstrapResult(
        point=point, ci_lower=lo, ci_upper=hi, alpha=alpha, n_resamples=n_resamples
    )


def bootstrap_diff_ci(
    successes_treatment: int,
    n_treatment: int,
    successes_control: int,
    n_control: int,
    alpha: float = 0.05,
    n_resamples: int = 10_000,
    seed: int = 42,
) -> BootstrapResult:
    """Percentile bootstrap CI for p_treatment - p_control (independent)."""
    if n_treatment <= 0 or n_control <= 0:
        raise ValueError("n must be > 0")
    rng = random.Random(seed)
    p_t = successes_treatment / n_treatment
    p_c = successes_control / n_control
    point = p_t - p_c
    diffs: list[float] = []
    for _ in range(n_resamples):
        st = sum(1 for _ in range(n_treatment) if rng.random() < p_t)
        sc = sum(1 for _ in range(n_control) if rng.random() < p_c)
        diffs.append(st / n_treatment - sc / n_control)
    diffs.sort()
    lo = diffs[int((alpha / 2) * n_resamples)]
    hi = diffs[int((1 - alpha / 2) * n_resamples)]
    return BootstrapResult(
        point=point, ci_lower=lo, ci_upper=hi, alpha=alpha, n_resamples=n_resamples
    )


def mcnemar_test(b: int, c: int) -> float:
    """McNemar exact two-sided p-value for paired binary outcomes.

    `b` is the count of pairs where treatment=cited and control=not_cited;
    `c` is where treatment=not_cited and control=cited. Computes the binomial
    tail of the smaller of (b, c) under H0: p=0.5, then doubles for two-sided.
    """
    n = b + c
    if n == 0:
        return 1.0
    smaller = min(b, c)
    p = 0.0
    log_half_n = n * math.log(0.5)
    for i in range(smaller + 1):
        log_coef = math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1)
        p += math.exp(log_coef + log_half_n)
    p_two_sided = min(1.0, 2 * p)
    return p_two_sided
