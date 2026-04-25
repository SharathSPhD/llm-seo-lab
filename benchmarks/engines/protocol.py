"""Engine protocol shared by all adapters."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

from benchmarks.questions import Question

EngineName = Literal["perplexity", "chatgpt", "google_aio", "gemini", "claude_ai"]


@dataclass(frozen=True)
class CitationEvent:
    qid: str
    engine: EngineName
    site_id: str
    treatment: str
    cited: bool


class Engine(Protocol):
    """Adapter interface for a measurement engine.

    `query` returns one `CitationEvent` per site — exactly one Bernoulli
    draw per (question, engine, site, treatment) tuple, matching the
    statistical model in §3 / §11 of methodology.md.
    """

    name: EngineName

    def query(
        self,
        question: Question,
        site_id: str,
        treatment: str,
    ) -> CitationEvent: ...
