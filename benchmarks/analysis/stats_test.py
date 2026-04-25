"""Unit tests for benchmarks.analysis.stats and benchmarks.analysis.power.

Run with `python -m unittest benchmarks.analysis.stats_test`.

Test values were independently computed in R (`prop.test`, `pwr.2p.test`,
`pwr::ES.h`) on 2026-04-25 to validate the standard-library implementation.
"""

from __future__ import annotations

import unittest

from benchmarks.analysis import (
    bonferroni_correct,
    bootstrap_diff_ci,
    bootstrap_proportion_ci,
    cohens_h,
    mcnemar_test,
    required_n_two_proportion,
    two_proportion_z_test,
)


class TestTwoProportionTest(unittest.TestCase):
    def test_classic_textbook_example(self) -> None:
        # 200 cited / 1000 vs 250 cited / 1000.
        # R: prop.test(c(250,200), c(1000,1000), correct=FALSE)
        # X-squared = 7.1685, so z = sqrt(7.1685) = 2.6774.
        # We use one-sided H1: p_treatment > p_control, so p ≈ 0.0037.
        r = two_proportion_z_test(
            successes_treatment=250,
            n_treatment=1000,
            successes_control=200,
            n_control=1000,
        )
        self.assertAlmostEqual(r.p1, 0.25)
        self.assertAlmostEqual(r.p0, 0.20)
        self.assertAlmostEqual(r.z, 2.6774, places=3)
        self.assertLess(r.p_value_one_sided, 0.005)
        self.assertTrue(r.significant)

    def test_no_difference_returns_zero_z(self) -> None:
        r = two_proportion_z_test(100, 500, 100, 500)
        self.assertAlmostEqual(r.z, 0.0)
        self.assertAlmostEqual(r.p_value_one_sided, 0.5, places=4)
        self.assertFalse(r.significant)

    def test_validates_n(self) -> None:
        with self.assertRaises(ValueError):
            two_proportion_z_test(0, 0, 1, 10)


class TestBonferroni(unittest.TestCase):
    def test_corrects_alpha_by_k(self) -> None:
        tests = [
            two_proportion_z_test(250, 1000, 200, 1000),
            two_proportion_z_test(220, 1000, 210, 1000),
            two_proportion_z_test(300, 1000, 200, 1000),
            two_proportion_z_test(205, 1000, 200, 1000),
        ]
        corrected = bonferroni_correct(tests, family_alpha=0.05)
        self.assertTrue(all(t.alpha == 0.05 / 4 for t in corrected))
        self.assertTrue(corrected[0].significant)
        self.assertFalse(corrected[1].significant)
        self.assertTrue(corrected[2].significant)
        self.assertFalse(corrected[3].significant)

    def test_empty_input(self) -> None:
        self.assertEqual(bonferroni_correct([]), [])


class TestCohensH(unittest.TestCase):
    def test_known_value(self) -> None:
        # R: pwr::ES.h(p1=0.25, p2=0.20) ≈ 0.1199
        h = cohens_h(0.20, 0.25)
        self.assertAlmostEqual(h.h, 0.1199, places=3)

    def test_zero_when_proportions_equal(self) -> None:
        h = cohens_h(0.30, 0.30)
        self.assertAlmostEqual(h.h, 0.0)


class TestBootstrap(unittest.TestCase):
    def test_proportion_ci_covers_truth(self) -> None:
        r = bootstrap_proportion_ci(successes=250, n=1000, n_resamples=2000, seed=7)
        self.assertAlmostEqual(r.point, 0.25)
        self.assertLess(r.ci_lower, 0.25)
        self.assertGreater(r.ci_upper, 0.25)
        self.assertLess(r.ci_upper - r.ci_lower, 0.10)

    def test_diff_ci_excludes_zero_for_clear_signal(self) -> None:
        r = bootstrap_diff_ci(
            successes_treatment=300,
            n_treatment=1000,
            successes_control=200,
            n_control=1000,
            n_resamples=2000,
            seed=7,
        )
        self.assertAlmostEqual(r.point, 0.10)
        self.assertGreater(r.ci_lower, 0.0)
        self.assertGreater(r.ci_upper, r.ci_lower)


class TestMcnemar(unittest.TestCase):
    def test_zero_discordant(self) -> None:
        self.assertEqual(mcnemar_test(0, 0), 1.0)

    def test_strong_signal_b_dominates(self) -> None:
        # 50/50 split should be near-significant; 50/0 must be ≪ 0.001.
        self.assertGreater(mcnemar_test(50, 50), 0.5)
        self.assertLess(mcnemar_test(50, 0), 1e-6)


class TestPower(unittest.TestCase):
    def test_methodology_unadjusted_n(self) -> None:
        # methodology.md §8: p0=0.20, p1=0.25, α=0.05, power=0.80, one-sided.
        # The Fleiss-style two-variance formula used in power.py gives
        # n = 862 per arm. This must stay stable so the methodology
        # pre-registration (§8) cannot drift relative to the implementation.
        r = required_n_two_proportion(p0=0.20, p1=0.25, alpha=0.05, power=0.80, one_sided=True)
        self.assertEqual(r.n_per_arm, 862)

    def test_methodology_bonferroni_n(self) -> None:
        # methodology.md §8: same MDE under Bonferroni K=4, α'=0.0125.
        # Required n grows to 1325 per arm; we ship N=1500.
        r = required_n_two_proportion(
            p0=0.20, p1=0.25, alpha=0.0125, power=0.80, one_sided=True
        )
        self.assertEqual(r.n_per_arm, 1325)

    def test_smaller_effect_needs_more(self) -> None:
        a = required_n_two_proportion(0.20, 0.25, alpha=0.05, power=0.80)
        b = required_n_two_proportion(0.20, 0.22, alpha=0.05, power=0.80)
        self.assertGreater(b.n_per_arm, a.n_per_arm)

    def test_two_sided_needs_more_than_one_sided(self) -> None:
        one = required_n_two_proportion(0.20, 0.25, one_sided=True)
        two = required_n_two_proportion(0.20, 0.25, one_sided=False)
        self.assertGreater(two.n_per_arm, one.n_per_arm)


if __name__ == "__main__":
    unittest.main()
