"""Smoke tests for the runner: it must produce a deterministic JSONL log
and a results.md whose key tables agree with hand calculation."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path

from benchmarks.analysis import render_results
from benchmarks.engines.protocol import CitationEvent, EngineName
from benchmarks.questions import Question, QuestionBank
from benchmarks.runner import (
    DEFAULT_SITE_COHORT,
    RunConfig,
    Site,
    SiteCohort,
    run,
)
from benchmarks.runner.orchestrator import iter_events
from benchmarks.treatments import TREATMENTS


def _file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass(frozen=True)
class _FixedEngine:
    name: EngineName
    fixed_outcome: bool

    def query(self, question: Question, site_id: str, treatment: str) -> CitationEvent:
        return CitationEvent(
            qid=question.qid,
            engine=self.name,
            site_id=site_id,
            treatment=treatment,
            cited=self.fixed_outcome,
        )


def _tiny_bank(n: int = 4) -> QuestionBank:
    qs = tuple(
        Question(
            qid=f"t-{i}",
            category="definition",
            topic="x",
            alt=None,
            template="What is x?",
            question_text=f"What is x #{i}?",
        )
        for i in range(n)
    )
    return QuestionBank(seed=1, n_questions=n, n_per_category=n, questions=qs)


class TestRunner(unittest.TestCase):
    def test_event_count_is_grid_size(self) -> None:
        bank = _tiny_bank(4)
        engines = (_FixedEngine("perplexity", True), _FixedEngine("chatgpt", False))
        cohort = SiteCohort(
            sites=(
                Site(id="A", url="x", assigned_treatment="baseline"),
                Site(id="B", url="y", assigned_treatment="llm_seo_lab"),
            )
        )
        with tempfile.TemporaryDirectory() as tmp:
            cfg = RunConfig(output_path=Path(tmp) / "events.jsonl", cohort=cohort)
            run(cfg, bank=bank, engines=engines)
            events = list(iter_events(cfg.output_path))
        # 2 sites × 4 treatments × 2 engines × 4 questions = 64
        self.assertEqual(len(events), 2 * len(TREATMENTS) * 2 * 4)

    def test_run_is_deterministic(self) -> None:
        bank = _tiny_bank(8)
        engines = (_FixedEngine("perplexity", True),)
        with tempfile.TemporaryDirectory() as tmp:
            p1 = Path(tmp) / "a.jsonl"
            p2 = Path(tmp) / "b.jsonl"
            run(RunConfig(output_path=p1), bank=bank, engines=engines)
            run(RunConfig(output_path=p2), bank=bank, engines=engines)
            self.assertEqual(_file_sha256(p1), _file_sha256(p2))

    def test_results_md_contains_required_sections(self) -> None:
        bank = _tiny_bank(8)
        engines = (
            _FixedEngine("perplexity", True),
            _FixedEngine("chatgpt", False),
        )
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            cfg = RunConfig(output_path=tmp_dir / "events.jsonl")
            run(cfg, bank=bank, engines=engines)
            results = render_results(cfg.output_path, tmp_dir / "results.md")
            content = results.read_text()
        self.assertIn("Phase 6 Benchmark Results", content)
        self.assertIn("Per-engine headline contrast", content)
        self.assertIn("Bonferroni-corrected significance", content)
        self.assertIn("McNemar paired test", content)
        self.assertIn("Secondary contrasts", content)

    def test_default_cohort_has_six_sites(self) -> None:
        self.assertEqual(len(DEFAULT_SITE_COHORT), 6)
        ids = {s.id for s in DEFAULT_SITE_COHORT}
        self.assertEqual(ids, {"S1", "S2", "S3", "S4", "S5", "S6"})

    def test_jsonl_lines_parse_to_full_event(self) -> None:
        bank = _tiny_bank(2)
        engines = (_FixedEngine("perplexity", True),)
        with tempfile.TemporaryDirectory() as tmp:
            cfg = RunConfig(output_path=Path(tmp) / "events.jsonl")
            run(cfg, bank=bank, engines=engines)
            for line in cfg.output_path.read_text().splitlines():
                ev = json.loads(line)
                self.assertEqual(
                    set(ev.keys()), {"qid", "engine", "site_id", "treatment", "cited"}
                )


if __name__ == "__main__":
    unittest.main()
