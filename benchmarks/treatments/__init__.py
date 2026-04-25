"""Treatment definitions for the Phase 6 benchmark.

A *treatment* in this experiment is a string label attached to every
(question, engine, site) tuple — it does not modify the engine query in the
simulated harness; the calibrated lift lives in the engine's per-treatment
probability table. In Phase 7, when real engines come online, the treatment
modules below are responsible for actually applying the intervention to the
site (writing the audit, generating the brief, opening the PR, merging it).

For Phase 6 the modules just provide:
    - the treatment id used in event logs,
    - a human-readable description shown in `results.md`,
    - a `prepare(site)` no-op hook the runner calls before measurement.
"""

from benchmarks.treatments.registry import (
    TREATMENTS,
    Treatment,
    treatment_by_id,
)

__all__ = ["TREATMENTS", "Treatment", "treatment_by_id"]
