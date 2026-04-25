"""Static registry of the four treatments declared in methodology.md §5."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class Treatment:
    id: str
    description: str
    is_control: bool


TREATMENTS: Final[tuple[Treatment, ...]] = (
    Treatment(
        id="baseline",
        description="No intervention; the site is measured as-is.",
        is_control=True,
    ),
    Treatment(
        id="athenahq_style",
        description=(
            "Monitoring-only intervention: surface the visibility gap list, "
            "do not autonomously act."
        ),
        is_control=False,
    ),
    Treatment(
        id="profound_style",
        description=(
            "Monitoring + a managed-services brief draft delivered out-of-band; "
            "the site owner still applies it manually."
        ),
        is_control=False,
    ),
    Treatment(
        id="llm_seo_lab",
        description=(
            "Closed loop: audit → brief → PR → merge driven by the "
            "llm-seo-lab agent."
        ),
        is_control=False,
    ),
)


_BY_ID = {t.id: t for t in TREATMENTS}


def treatment_by_id(treatment_id: str) -> Treatment:
    if treatment_id not in _BY_ID:
        raise KeyError(f"unknown treatment {treatment_id!r}")
    return _BY_ID[treatment_id]
