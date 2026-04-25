"""Simulation-engine determinism + calibration tests."""

from __future__ import annotations

import unittest

from benchmarks.engines import build_default_engines
from benchmarks.questions import generate_question_bank


class TestSimulatedEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = generate_question_bank()
        cls.engines = build_default_engines()
        cls.q0 = cls.bank.questions[0]

    def test_query_is_deterministic(self) -> None:
        e = self.engines[0]
        a = e.query(self.q0, "S1", "baseline")
        b = e.query(self.q0, "S1", "baseline")
        self.assertEqual(a.cited, b.cited)
        self.assertEqual(a.qid, self.q0.qid)
        self.assertEqual(a.engine, e.name)

    def test_treatment_changes_outcome_distribution(self) -> None:
        # Across the full bank, llm_seo_lab arm must show a higher empirical
        # cite rate than the baseline arm at site S1 — calibration check.
        e = self.engines[0]
        b_rate = sum(
            e.query(q, "S1", "baseline").cited for q in self.bank.questions
        ) / self.bank.n_questions
        l_rate = sum(
            e.query(q, "S1", "llm_seo_lab").cited for q in self.bank.questions
        ) / self.bank.n_questions
        self.assertGreater(l_rate, b_rate)
        # Empirical rate should land within ±0.03 of the configured probability.
        self.assertAlmostEqual(b_rate, e.probability("baseline"), delta=0.03)
        self.assertAlmostEqual(l_rate, e.probability("llm_seo_lab"), delta=0.03)

    def test_unknown_treatment_raises(self) -> None:
        with self.assertRaises(ValueError):
            self.engines[0].query(self.q0, "S1", "totally-made-up")

    def test_all_five_engines_present(self) -> None:
        names = {e.name for e in self.engines}
        self.assertEqual(
            names,
            {"perplexity", "chatgpt", "google_aio", "gemini", "claude_ai"},
        )


if __name__ == "__main__":
    unittest.main()
