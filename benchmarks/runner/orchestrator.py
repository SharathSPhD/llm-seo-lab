"""Run one benchmark sweep across (question × engine × site × treatment).

The orchestrator is intentionally simple: it walks the grid in a fixed
canonical order so the JSONL output is byte-stable for a given config, lets
each engine produce one `CitationEvent`, and writes events one-per-line.

Statistical analysis runs offline against the resulting `events.jsonl` —
the runner does not compute any test statistics itself.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

from benchmarks.engines import Engine, build_default_engines
from benchmarks.questions import QuestionBank, generate_question_bank
from benchmarks.treatments import TREATMENTS, Treatment


@dataclass(frozen=True)
class Site:
    id: str
    url: str
    assigned_treatment: str


# The six-site cohort declared in methodology.md §6. The Phase-7 URLs
# are placeholders here; the runner does not actually visit them in the
# Phase-6 simulation.
DEFAULT_SITE_COHORT: tuple[Site, ...] = (
    Site(id="S1", url="https://technektar.dev", assigned_treatment="llm_seo_lab"),
    Site(id="S2", url="https://technektar.substack.com", assigned_treatment="llm_seo_lab"),
    Site(id="S3", url="https://sharathsphd.github.io", assigned_treatment="llm_seo_lab"),
    Site(id="S4", url="https://example-control.invalid", assigned_treatment="baseline"),
    Site(id="S5", url="https://example-athenahq-style.invalid", assigned_treatment="athenahq_style"),
    Site(id="S6", url="https://example-profound-style.invalid", assigned_treatment="profound_style"),
)


@dataclass(frozen=True)
class SiteCohort:
    sites: tuple[Site, ...] = DEFAULT_SITE_COHORT


@dataclass(frozen=True)
class RunConfig:
    output_path: Path
    cohort: SiteCohort = field(default_factory=SiteCohort)
    treatments: tuple[Treatment, ...] = TREATMENTS
    seed: int = 20260425


def _serialize_event(event_dict: dict) -> str:
    return json.dumps(event_dict, sort_keys=True, separators=(",", ":"))


def run(
    config: RunConfig,
    *,
    bank: QuestionBank | None = None,
    engines: Sequence[Engine] | None = None,
) -> Path:
    """Execute the full grid and write JSONL events to `config.output_path`.

    Returns the output path on success. The function is pure with respect to
    its inputs: given the same config, bank, and engines, the file contents
    are byte-identical.
    """
    bank = bank if bank is not None else generate_question_bank()
    engines = engines if engines is not None else build_default_engines(seed=config.seed)
    config.output_path.parent.mkdir(parents=True, exist_ok=True)

    with config.output_path.open("w", encoding="utf-8") as fh:
        for site in config.cohort.sites:
            for treatment in config.treatments:
                for engine in engines:
                    for question in bank.questions:
                        event = engine.query(
                            question=question,
                            site_id=site.id,
                            treatment=treatment.id,
                        )
                        fh.write(_serialize_event(asdict(event)) + "\n")
    return config.output_path


def iter_events(path: Path) -> Iterable[dict]:
    """Yield each event as a dict for downstream analysis."""
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)
