"""Tests for the results renderer."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from benchmarks.analysis import render_results
from benchmarks.engines import build_default_engines
from benchmarks.questions import generate_question_bank
from benchmarks.runner import RunConfig, run


class TestRenderer(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = generate_question_bank()
        cls.engines = build_default_engines()
        cls.tmp = tempfile.TemporaryDirectory()
        cls.events_path = Path(cls.tmp.name) / "events.jsonl"
        cls.results_path = Path(cls.tmp.name) / "results.md"
        run(RunConfig(output_path=cls.events_path), bank=cls.bank, engines=cls.engines)
        render_results(cls.events_path, cls.results_path)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def test_results_md_has_ascii_plot(self) -> None:
        content = self.results_path.read_text()
        self.assertIn("Headline Δ visualised", content)
        # ASCII bars: at least one full block char of length 1+ for the largest Δ.
        self.assertIn("█", content)

    def test_summary_json_written(self) -> None:
        sj = self.results_path.with_name("summary.json")
        self.assertTrue(sj.exists())
        payload = json.loads(sj.read_text())
        self.assertEqual(payload["schema_version"], 1)
        rows = payload["by_engine_site_treatment"]
        # 5 engines × 6 sites × 4 treatments = 120 rows.
        self.assertEqual(len(rows), 120)
        for r in rows:
            self.assertIn(r["engine"], {"perplexity", "chatgpt", "google_aio", "gemini", "claude_ai"})
            self.assertEqual(r["n"], 1500)
            self.assertGreaterEqual(r["successes"], 0)
            self.assertLessEqual(r["successes"], r["n"])

    def test_summary_json_round_trips_to_observed_rates(self) -> None:
        # Pick a known cell and verify rate matches what we'd expect from the
        # calibrated engine probability table within ±0.025.
        sj = self.results_path.with_name("summary.json")
        payload = json.loads(sj.read_text())
        for r in payload["by_engine_site_treatment"]:
            if (r["engine"], r["site_id"], r["treatment"]) == ("perplexity", "S1", "llm_seo_lab"):
                # baseline 0.20 + uplift 0.07 = 0.27 expected.
                self.assertAlmostEqual(r["rate"], 0.27, delta=0.025)
                break
        else:
            self.fail("expected (perplexity, S1, llm_seo_lab) row not found")


if __name__ == "__main__":
    unittest.main()
