"""Deterministic question-bank generator.

Given the seed file at `benchmarks/questions/seeds.json`, build a stable list
of `Question` objects whose ordering and contents depend only on the seed.

Properties enforced by `bank_test.py`:
    1. Bit-for-bit reproducibility across processes / machines.
    2. Exactly `n_per_category` questions per category, totalling `n_questions`.
    3. Distinct text (no duplicate `question_text`).
    4. Each question references a topic that exists in the seed file.

The generator does **not** call out to any LLM. It is pure-Python, stdlib-only.
"""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Final

CATEGORIES: Final[tuple[str, str, str, str]] = (
    "comparison",
    "recommendation",
    "howto",
    "definition",
)

_DEFAULT_SEEDS_PATH = Path(__file__).resolve().parent / "seeds.json"


@dataclass(frozen=True)
class Question:
    qid: str
    category: str
    topic: str
    alt: str | None
    template: str
    question_text: str


@dataclass(frozen=True)
class QuestionBank:
    seed: int
    n_questions: int
    n_per_category: int
    questions: tuple[Question, ...]

    def by_category(self, category: str) -> tuple[Question, ...]:
        return tuple(q for q in self.questions if q.category == category)


def load_topic_seeds(path: Path | None = None) -> dict:
    p = path or _DEFAULT_SEEDS_PATH
    with p.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _qid(category: str, idx: int, text: str) -> str:
    h = hashlib.sha256(f"{category}:{idx}:{text}".encode("utf-8")).hexdigest()[:12]
    return f"{category[:4]}-{idx:04d}-{h}"


def _render(template: str, topic: str, alt: str | None) -> str:
    if "{alt}" in template:
        if alt is None:
            raise ValueError(f"template {template!r} requires an alt")
        return template.format(topic=topic, alt=alt)
    return template.format(topic=topic)


def generate_question_bank(seeds: dict | None = None) -> QuestionBank:
    """Deterministically build the question bank from the seed file.

    Algorithm:
      1. Seed `random.Random(rng_seed)` with the configured integer.
      2. For each of the four categories, draw `n_per_category` questions by
         iterating topics in their listed order and templates in their listed
         order, falling back to extra random combinations only when the cross
         product is exhausted.
      3. For comparison-category templates, pair the topic with one of its
         registered `alts` (chosen by the same RNG) so the wording stays
         realistic.

    The seed dict is consumed read-only.
    """
    cfg = seeds if seeds is not None else load_topic_seeds()
    rng = random.Random(cfg["rng_seed"])
    n_per_cat = int(cfg["n_per_category"])
    n_total = int(cfg["n_questions"])
    if n_total != n_per_cat * len(CATEGORIES):
        raise ValueError(
            f"n_questions={n_total} must equal n_per_category={n_per_cat} * "
            f"{len(CATEGORIES)} = {n_per_cat * len(CATEGORIES)}"
        )

    topics: list[dict] = list(cfg["topics"])
    if not topics:
        raise ValueError("seeds.topics is empty")
    templates: dict[str, list[str]] = {c: list(cfg["templates"][c]) for c in CATEGORIES}

    out: list[Question] = []
    for category in CATEGORIES:
        seen: set[str] = set()
        cat_questions: list[Question] = []
        idx = 0
        attempts = 0
        max_attempts = n_per_cat * 50
        while len(cat_questions) < n_per_cat and attempts < max_attempts:
            attempts += 1
            topic_entry = topics[(rng.randrange(len(topics)))]
            topic = topic_entry["name"]
            template = templates[category][rng.randrange(len(templates[category]))]
            alt: str | None = None
            if "{alt}" in template:
                alts = list(topic_entry.get("alts", []))
                if not alts:
                    continue
                alt = alts[rng.randrange(len(alts))]
                if alt == topic:
                    continue
            text = _render(template, topic, alt)
            if text in seen:
                continue
            seen.add(text)
            cat_questions.append(
                Question(
                    qid=_qid(category, idx, text),
                    category=category,
                    topic=topic,
                    alt=alt,
                    template=template,
                    question_text=text,
                )
            )
            idx += 1
        if len(cat_questions) < n_per_cat:
            raise RuntimeError(
                f"category {category!r}: only generated {len(cat_questions)}/"
                f"{n_per_cat} unique questions in {attempts} attempts; widen "
                f"seeds.json topics or templates"
            )
        out.extend(cat_questions)

    return QuestionBank(
        seed=int(cfg["rng_seed"]),
        n_questions=n_total,
        n_per_category=n_per_cat,
        questions=tuple(out),
    )
