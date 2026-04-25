"""Closed-form power analysis for the two-proportion z-test.

Used by `docs/benchmarks/methodology.md` §8 to justify N = 1000 per arm.
No SciPy dependency — uses the standard normal inverse CDF approximation
from Acklam so the harness stays dependency-free.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _ndtri(p: float) -> float:
    """Inverse standard normal CDF (Acklam 2003)."""
    if not 0 < p < 1:
        raise ValueError("p must be in (0, 1)")
    a = [
        -3.969683028665376e01,
        2.209460984245205e02,
        -2.759285104469687e02,
        1.383577518672690e02,
        -3.066479806614716e01,
        2.506628277459239e00,
    ]
    b = [
        -5.447609879822406e01,
        1.615858368580409e02,
        -1.556989798598866e02,
        6.680131188771972e01,
        -1.328068155288572e01,
    ]
    c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e00,
        -2.549732539343734e00,
        4.374664141464968e00,
        2.938163982698783e00,
    ]
    d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e00,
        3.754408661907416e00,
    ]
    plow = 0.02425
    phigh = 1.0 - plow
    if p < plow:
        q = math.sqrt(-2.0 * math.log(p))
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0
        )
    if p <= phigh:
        q = p - 0.5
        r = q * q
        return (
            ((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]
        ) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
    q = math.sqrt(-2.0 * math.log(1.0 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0
    )


@dataclass(frozen=True)
class PowerResult:
    p0: float
    p1: float
    alpha: float
    power: float
    n_per_arm: int


def required_n_two_proportion(
    p0: float,
    p1: float,
    alpha: float = 0.05,
    power: float = 0.80,
    one_sided: bool = True,
) -> PowerResult:
    """Required sample size per arm for a two-proportion test.

    Uses the standard normal-approximation formula

        n = (z_{1-α} sqrt(2 p̄ (1-p̄)) + z_{1-β} sqrt(p0(1-p0) + p1(1-p1)))² / Δ²

    where p̄ = (p0+p1)/2 and Δ = p1 - p0.
    """
    if not 0 < p0 < 1 or not 0 < p1 < 1:
        raise ValueError("proportions must be in (0,1)")
    if p1 == p0:
        raise ValueError("p1 must differ from p0")
    z_alpha = _ndtri(1 - alpha) if one_sided else _ndtri(1 - alpha / 2)
    z_beta = _ndtri(power)
    p_bar = (p0 + p1) / 2.0
    pooled = math.sqrt(2 * p_bar * (1 - p_bar))
    sep = math.sqrt(p0 * (1 - p0) + p1 * (1 - p1))
    delta = abs(p1 - p0)
    n = ((z_alpha * pooled + z_beta * sep) ** 2) / (delta**2)
    return PowerResult(p0=p0, p1=p1, alpha=alpha, power=power, n_per_arm=int(math.ceil(n)))
