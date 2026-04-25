"""Statistical analysis pipeline for the AEO benchmark.

All pure-function statistics live in `power.py` and `stats.py`. The
`renderer` module composes them into a Markdown report from a JSONL log.
"""

from benchmarks.analysis.power import PowerResult, required_n_two_proportion
from benchmarks.analysis.renderer import render_results
from benchmarks.analysis.stats import (
    BootstrapResult,
    CohensH,
    TwoProportionTest,
    bonferroni_correct,
    bootstrap_diff_ci,
    bootstrap_proportion_ci,
    cohens_h,
    mcnemar_test,
    two_proportion_z_test,
)

__all__ = [
    "BootstrapResult",
    "CohensH",
    "PowerResult",
    "TwoProportionTest",
    "bonferroni_correct",
    "bootstrap_diff_ci",
    "bootstrap_proportion_ci",
    "cohens_h",
    "mcnemar_test",
    "render_results",
    "required_n_two_proportion",
    "two_proportion_z_test",
]
