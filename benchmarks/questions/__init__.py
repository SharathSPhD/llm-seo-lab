"""Deterministic synthetic question bank for the Phase 6 benchmark.

The bank is generated from a single integer seed plus a topical-seed file so
the entire experiment can be reproduced bit-for-bit on a fresh checkout.

Public API:
    Question                  — a single buyer question with provenance.
    QuestionBank              — a frozen, ordered list of Question.
    generate_question_bank()  — deterministic constructor.
    load_topic_seeds()        — read `seeds.json`.
"""

from benchmarks.questions.bank import (
    CATEGORIES,
    Question,
    QuestionBank,
    generate_question_bank,
    load_topic_seeds,
)

__all__ = [
    "CATEGORIES",
    "Question",
    "QuestionBank",
    "generate_question_bank",
    "load_topic_seeds",
]
