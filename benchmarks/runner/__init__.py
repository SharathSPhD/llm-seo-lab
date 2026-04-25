"""Phase 6 benchmark runner.

Public API:
    SiteCohort        — the six sites declared in methodology.md §6.
    RunConfig         — frozen run configuration.
    run               — execute the full grid and return the JSONL path.
"""

from benchmarks.runner.orchestrator import (
    DEFAULT_SITE_COHORT,
    RunConfig,
    Site,
    SiteCohort,
    run,
)

__all__ = [
    "DEFAULT_SITE_COHORT",
    "RunConfig",
    "Site",
    "SiteCohort",
    "run",
]
