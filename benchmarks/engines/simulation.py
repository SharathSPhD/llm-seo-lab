"""Simulated engine adapters (Phase 6).

Each `SimulatedEngine` exposes a deterministic Bernoulli draw for a given
(question, site, treatment) tuple. The draw is seeded by hashing the inputs
plus a top-level harness seed, so the entire benchmark is reproducible.

Per-(engine × treatment) base citation rates are calibrated against the
published baselines surveyed in `docs/research/seo_research_2.md`:

    Perplexity   baseline ≈ 0.20  llm_seo_lab uplift = +0.07
    ChatGPT      baseline ≈ 0.18  llm_seo_lab uplift = +0.06
    Google AIO   baseline ≈ 0.22  llm_seo_lab uplift = +0.05
    Gemini       baseline ≈ 0.16  llm_seo_lab uplift = +0.05
    Claude.ai    baseline ≈ 0.19  llm_seo_lab uplift = +0.06

Monitoring-only treatments (`athenahq_style`, `profound_style`) get a smaller
uplift (+0.01 / +0.02) consistent with the "passive monitoring" gap thesis.

The simulation does NOT prove the product works. It validates the harness
end-to-end; real-engine measurement happens in Phase 7.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping

from benchmarks.engines.protocol import CitationEvent, Engine, EngineName
from benchmarks.questions import Question

_TREATMENTS = ("baseline", "athenahq_style", "profound_style", "llm_seo_lab")

_DEFAULT_BASELINE: Mapping[EngineName, float] = {
    "perplexity": 0.20,
    "chatgpt": 0.18,
    "google_aio": 0.22,
    "gemini": 0.16,
    "claude_ai": 0.19,
}

_DEFAULT_UPLIFT: Mapping[EngineName, Mapping[str, float]] = {
    "perplexity": {"baseline": 0.0, "athenahq_style": 0.01, "profound_style": 0.02, "llm_seo_lab": 0.07},
    "chatgpt": {"baseline": 0.0, "athenahq_style": 0.01, "profound_style": 0.02, "llm_seo_lab": 0.06},
    "google_aio": {"baseline": 0.0, "athenahq_style": 0.01, "profound_style": 0.02, "llm_seo_lab": 0.05},
    "gemini": {"baseline": 0.0, "athenahq_style": 0.01, "profound_style": 0.02, "llm_seo_lab": 0.05},
    "claude_ai": {"baseline": 0.0, "athenahq_style": 0.01, "profound_style": 0.02, "llm_seo_lab": 0.06},
}


def _bernoulli_from_hash(seed: int, *parts: str, p: float) -> bool:
    """Deterministic Bernoulli(p) draw seeded by the SHA-256 of the parts."""
    if not 0 <= p <= 1:
        raise ValueError(f"p must be in [0,1], got {p}")
    blob = ("|".join((str(seed), *parts))).encode("utf-8")
    digest = hashlib.sha256(blob).digest()
    u_int = int.from_bytes(digest[:8], "big")
    u = u_int / 2**64
    return u < p


@dataclass(frozen=True)
class SimulatedEngine(Engine):
    name: EngineName
    seed: int
    baseline: float
    uplift: Mapping[str, float]

    def __post_init__(self) -> None:
        if self.name not in _DEFAULT_BASELINE:
            raise ValueError(f"unknown engine name: {self.name}")
        for t in _TREATMENTS:
            if t not in self.uplift:
                raise ValueError(f"engine {self.name}: missing uplift for {t}")

    def probability(self, treatment: str) -> float:
        if treatment not in self.uplift:
            raise ValueError(f"unknown treatment {treatment!r} for engine {self.name}")
        p = self.baseline + self.uplift[treatment]
        return min(max(p, 0.0), 1.0)

    def query(self, question: Question, site_id: str, treatment: str) -> CitationEvent:
        p = self.probability(treatment)
        cited = _bernoulli_from_hash(
            self.seed, self.name, question.qid, site_id, treatment, p=p
        )
        return CitationEvent(
            qid=question.qid,
            engine=self.name,
            site_id=site_id,
            treatment=treatment,
            cited=cited,
        )


DEFAULT_ENGINES: tuple[EngineName, ...] = (
    "perplexity",
    "chatgpt",
    "google_aio",
    "gemini",
    "claude_ai",
)


def build_default_engines(seed: int = 20260425) -> tuple[SimulatedEngine, ...]:
    """Construct the five-engine cohort wired up with the calibrated rates."""
    return tuple(
        SimulatedEngine(
            name=name,
            seed=seed,
            baseline=_DEFAULT_BASELINE[name],
            uplift=_DEFAULT_UPLIFT[name],
        )
        for name in DEFAULT_ENGINES
    )
