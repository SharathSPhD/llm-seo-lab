"""Engine adapters for the Phase 6 benchmark.

Every adapter implements the `Engine` protocol — given a `Question` and a
`SiteCohort`, it returns a `CitationEvent` for each site, recording whether
the site appeared in the engine's structured citations / sources field.

Phase 6 ships **simulation-only** adapters so the entire harness can run
without burning real-engine quota. Each simulated engine is documented to
sample from a per-(engine × treatment) Beta-Bernoulli process whose
parameters live in `simulation.py`. Phase 7 swaps in real Playwright /
Claude CLI implementations behind the same protocol.
"""

from benchmarks.engines.protocol import (
    CitationEvent,
    Engine,
    EngineName,
)
from benchmarks.engines.simulation import (
    DEFAULT_ENGINES,
    SimulatedEngine,
    build_default_engines,
)

__all__ = [
    "CitationEvent",
    "DEFAULT_ENGINES",
    "Engine",
    "EngineName",
    "SimulatedEngine",
    "build_default_engines",
]
