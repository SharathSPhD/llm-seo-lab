"""Bank determinism + invariants tests.

Run with `python -m unittest benchmarks.questions.bank_test`.
"""

from __future__ import annotations

import hashlib
import json
import unittest

from benchmarks.questions import (
    CATEGORIES,
    QuestionBank,
    generate_question_bank,
    load_topic_seeds,
)


def _bank_fingerprint(bank: QuestionBank) -> str:
    blob = json.dumps(
        [(q.qid, q.category, q.topic, q.alt, q.question_text) for q in bank.questions],
        sort_keys=False,
    ).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class TestQuestionBank(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.seeds = load_topic_seeds()
        cls.bank = generate_question_bank(cls.seeds)

    def test_total_size_matches_methodology(self) -> None:
        # methodology.md §4 freezes N=1500.
        self.assertEqual(self.bank.n_questions, 1500)
        self.assertEqual(len(self.bank.questions), 1500)

    def test_per_category_count(self) -> None:
        for category in CATEGORIES:
            with self.subTest(category=category):
                self.assertEqual(len(self.bank.by_category(category)), 375)

    def test_no_duplicate_text(self) -> None:
        texts = [q.question_text for q in self.bank.questions]
        self.assertEqual(len(set(texts)), len(texts))

    def test_topic_in_seed_file(self) -> None:
        topic_names = {t["name"] for t in self.seeds["topics"]}
        for q in self.bank.questions:
            self.assertIn(q.topic, topic_names)

    def test_comparison_questions_have_alt(self) -> None:
        for q in self.bank.by_category("comparison"):
            self.assertIsNotNone(q.alt)
            self.assertNotEqual(q.alt, q.topic)
            self.assertIn(q.alt, q.question_text)

    def test_non_comparison_questions_have_no_alt(self) -> None:
        for q in self.bank.questions:
            if q.category != "comparison":
                self.assertIsNone(q.alt)

    def test_qids_unique(self) -> None:
        qids = [q.qid for q in self.bank.questions]
        self.assertEqual(len(set(qids)), len(qids))

    def test_deterministic_across_calls(self) -> None:
        b1 = generate_question_bank(self.seeds)
        b2 = generate_question_bank(self.seeds)
        self.assertEqual(_bank_fingerprint(b1), _bank_fingerprint(b2))

    def test_reseed_changes_bank(self) -> None:
        seeds = dict(self.seeds)
        seeds["rng_seed"] = self.seeds["rng_seed"] + 1
        other = generate_question_bank(seeds)
        self.assertNotEqual(
            _bank_fingerprint(other), _bank_fingerprint(self.bank)
        )

    def test_size_validation(self) -> None:
        seeds = dict(self.seeds)
        seeds["n_questions"] = 999
        with self.assertRaises(ValueError):
            generate_question_bank(seeds)


if __name__ == "__main__":
    unittest.main()
