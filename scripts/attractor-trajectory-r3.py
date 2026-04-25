#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "sentence-transformers>=3.0.0",
#   "numpy>=1.26.0",
#   "scipy>=1.12.0",
#   "scikit-learn>=1.4.0",
# ]
# ///
"""attractor-trajectory-r3.py — Phase R3 trajectory for pratyaksha integration.

Records each pratyaksha candidate (Sākṣī, Sublation, Manas/Buddhi,
Khyātivāda, Avacchedaka, Boundary compaction, Budget gauge) as a step in
the attractor-flow phase space, with the AEO closed-loop north star as
the goal anchor. Emits docs/triz/r3-pratyaksha-attractor.json.

Read alongside docs/decisions/2026-04-26-pratyaksha-integration.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ATTR = ROOT / "tools" / "attractor-flow" / "attractorflow" / "mcp-server"
sys.path.insert(0, str(ATTR))

from phase_space import PhaseSpaceMonitor  # noqa: E402
from lyapunov import LyapunovEstimator  # noqa: E402
from classifier import AttractorClassifier  # noqa: E402
from bifurcation import BifurcationDetector  # noqa: E402

GOAL = (
    "Closed-loop autonomous AEO/LLM-SEO citation engineering: the same Claude Code CLI "
    "subscription that audits a customer's page also drafts the fix as a reviewable PR, "
    "opens it against their repo, and re-audits after merge. Every recommendation is "
    "preserved in an audit trail; the loop runs over many turns without context drift; "
    "no synthetic citations are ever emitted; the witness invariants persist across the "
    "session and are never silently overwritten."
)

STEPS: list[tuple[str, str]] = [
    (
        "r3_baseline",
        "AEO loop today: audit_page produces a JSON of gaps, generate_brief drafts a fix per "
        "gap, open_pr opens a PR. No witness, no sublation gate, no boundary compaction. "
        "Long sessions silently drift; updated recommendations silently overwrite their "
        "predecessors; no audit trail at the recommendation level.",
    ),
    (
        "candidate_sakshi",
        "Sākṣī (witness invariant): pin a session-stable invariant ('subscription-only Claude "
        "CLI; audit precedes brief; brief precedes PR; no synthetic citations; never overwrite "
        "a prior recommendation — sublate it') as a system-prompt prefix on every Claude call. "
        "Cost: a few hundred tokens per call. Composes with Manas/Buddhi (gives Buddhi the "
        "policy to gate against) and with boundary compaction (witness elements never decay). "
        "TRIZ score: 3 on its primary contradiction (mutability vs traceability), 2 elsewhere; "
        "but indispensable as enabler.",
    ),
    (
        "candidate_sublation",
        "Sublation-with-evidence: any new brief that contradicts a previously recommended "
        "action is recorded as a sublation event in the pratyaksha store with a "
        "precision-weighted pointer to the superseded element, evidence_text, and a "
        "sublation_reason. The element is never deleted — the audit trail IS the "
        "supersession mechanism. TRIZ score: 4 on mutability vs traceability (Full IFR), "
        "3 on speed vs accuracy.",
    ),
    (
        "candidate_manas_buddhi",
        "Manas/Buddhi pair: Manas drafts the brief in one fast claude --print call. Buddhi "
        "verifies via pratyaksha.detect_conflict against the prior audit and "
        "pratyaksha.sublate_with_evidence on contradictions; PR open is gated on Buddhi "
        "clearance. The contradiction (fast brief AND verified citations) dissolves because "
        "Manas only owes speed and Buddhi only owes accuracy; they compose at the gate. "
        "TRIZ score: 4 on speed vs accuracy (Full IFR).",
    ),
    (
        "candidate_khyativada",
        "Khyātivāda heuristic classifier: a deterministic Python function inspects each "
        "generated brief's claim against a ground-truth audit string and labels it as "
        "anyathakhyati / akhyati / atmakhyati / yathartha. Adds a real new component "
        "(classifier code + tuned thresholds) the AEO loop must maintain. TRIZ score: 2 "
        "(Partial IFR) — does not leverage existing infrastructure and is not self-resolving.",
    ),
    (
        "candidate_avacchedaka",
        "Avacchedaka qualified store: every recommendation enters the context store as a "
        "(qualificand, qualifier, condition) triple via context_insert, so updates are "
        "addressable and queryable by qualifier (e.g. 'all recommendations qualified by "
        "tier:indie'). Replaces no existing AEO datastore; adds a metadata layer over today's "
        "flat JSON. TRIZ score: 3 (Near-IFR) — but Sublation already provides the actual "
        "supersession behaviour we need; Avacchedaka is consumed transitively, not "
        "reimplemented.",
    ),
    (
        "candidate_boundary_compaction",
        "Boundary compaction: when the rolling context exceeds a token budget, the pratyaksha "
        "store compacts older non-witness elements into a summary while preserving Sākṣī "
        "invariants verbatim. Reuses pratyaksha's boundary_compact + budget_status tools. "
        "TRIZ score: 4 on continuity vs accuracy (Full IFR). Acts at the engine layer, not "
        "the loop layer — consumed via the existing pratyaksha skill.",
    ),
    (
        "candidate_budget_gauge",
        "Budget gauge: pratyaksha's budget_status + budget_record write a small JSON file every "
        "turn with total / used / remaining tokens; when remaining < threshold the loop "
        "triggers boundary_compact pre-emptively. TRIZ score: 3 (Near-IFR). Useful but "
        "subsumed by boundary_compact's own internal budget tracking — defer until we have "
        "evidence of budget pressure in real runs.",
    ),
    (
        "verdict",
        "ADOPT Sākṣī + Sublation + Manas/Buddhi as first-class AEO loop components. CONSUME "
        "Avacchedaka and Boundary compaction transitively via the pratyaksha MCP without "
        "AEO-specific reimplementation. DEFER Khyātivāda and Budget gauge until we have "
        "concrete evidence that the cheaper mechanisms are insufficient. The loop becomes: "
        "SessionStart → Sākṣī.set_sakshi(AEO invariants) → for each gap: Manas drafts → "
        "Buddhi.detect_conflict → if conflict: sublate_with_evidence → open_pr if Buddhi "
        "clears.",
    ),
]


def main() -> None:
    print("[attractor-r3] booting Phase Space Monitor...", flush=True)
    monitor = PhaseSpaceMonitor()
    monitor.load_model()
    monitor.set_goal(GOAL)

    lyap = LyapunovEstimator(window=8)
    classifier = AttractorClassifier()
    bifurc = BifurcationDetector()

    out: dict[str, object] = {
        "session_id": "llm-seo-lab",
        "phase": "R3",
        "goal": GOAL,
        "steps": [],
    }

    ftle_history: list[float] = []
    regime_history = []
    for label, text in STEPS:
        rec = monitor.record(text)
        stats = monitor.get_stats()
        distances = monitor.get_distance_series()
        embeddings = monitor.get_embeddings_matrix()
        if len(distances) >= 2:
            lya = lyap.compute(distances, embeddings_matrix=embeddings)
            classification = classifier.classify(lya, stats)
            ftle_history.append(lya.ftle)
            regime_history.append(classification.regime)
            bifurc_result = bifurc.analyze(embeddings, regime_history, ftle_history)
            step_info = {
                "label": label,
                "step_index": rec.step_index,
                "ftle": round(lya.ftle, 4),
                "step_growth_rate": round(lya.step_growth_rate, 4),
                "isotropy_ratio": round(lya.isotropy_ratio, 4),
                "regime": classification.regime.value,
                "regime_confidence": round(classification.confidence, 3),
                "stability_label": lya.stability_label,
                "n_distances": len(distances),
                "mean_distance": round(stats.mean_distance, 4),
                "distance_trend": round(stats.distance_trend, 4),
                "goal_distance": round(stats.goal_distances[-1], 4) if stats.goal_distances else None,
                "bifurcation": bifurc_result.bifurcation_type.value if bifurc_result.detected else "NONE",
                "bifurcation_proximity": round(bifurc_result.proximity, 3),
            }
        else:
            step_info = {
                "label": label,
                "step_index": rec.step_index,
                "ftle": None,
                "regime": "unknown",
                "n_distances": len(distances),
                "mean_distance": stats.mean_distance,
                "goal_distance": stats.goal_distances[-1] if stats.goal_distances else None,
                "bifurcation": "NONE",
            }
        out["steps"].append(step_info)
        print(
            f"[attractor-r3] step {rec.step_index:>2} {label:<32} "
            f"ftle={step_info.get('ftle')} regime={step_info['regime']} "
            f"goal_d={step_info.get('goal_distance')} bifurc={step_info['bifurcation']}",
            flush=True,
        )

    out_path = ROOT / "docs" / "triz" / "r3-pratyaksha-attractor.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[attractor-r3] wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
