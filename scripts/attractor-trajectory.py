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
"""
attractor-trajectory.py — Generate Phase 2 attractor-flow baseline.

Records the TRIZ analysis trajectory through phase space using the
attractor-flow embedding monitor and emits diagnostics to
docs/triz/attractor-trajectory.json.

Each step is a one-paragraph summary of what the TRIZ analysis just did.
This trajectory is the design-space baseline for Phase 3 convergence.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ATTR = ROOT / "tools" / "attractor-flow" / "attractorflow" / "mcp-server"
sys.path.insert(0, str(ATTR))

from phase_space import PhaseSpaceMonitor
from lyapunov import LyapunovEstimator
from classifier import AttractorClassifier
from bifurcation import BifurcationDetector

GOAL = (
    "Design a path-breaking AEO/LLM-SEO platform that closes the loop "
    "between measuring AI citation share and acting on the gap, using a "
    "Claude Code CLI subscription as the reasoning oracle, priced flat, "
    "and validated statistically against SOTA tools."
)

STEPS = [
    ("phase1_baseline", "Synthesised Phase 1 research: 12 SOTA tools studied, all are dashboards; Peec.ai contractually disclaims influence; Wikipedia is 47.9% of ChatGPT top-10 concentration vs much lower in others; GEO paper shows Cite/Quotes/Stats lift 30-40%; technektar.dev sitemap.xml ships placeholder URLs."),
    ("c1_measure_vs_act", "TRIZ contradiction 1: improving param 28 Measurement Accuracy vs worsening param 38 Extent of Automation. Matrix recommends principles 28 (Mechanics Substitution), 2 (Taking Out), 10 (Preliminary Action), 34 (Discarding and Recovering). Physical-contradiction separation: System level wins 0.85 — whole system measures-and-acts, components specialise."),
    ("c2_recency_vs_authority", "TRIZ contradiction 2: improving param 9 Speed vs worsening param 27 Reliability. Matrix recommends principles 11 (Beforehand Cushioning), 35 (Parameter Changes), 27 (Cheap Short-living), 28 (Mechanics Substitution). Resolution direction: short-lived ephemeral artefacts that compound into authority via citations to a stable spine."),
    ("c3_structure_vs_voice", "TRIZ contradiction 3: improving param 12 Shape vs worsening param 35 Adaptability. Matrix recommends principles 1 (Segmentation), 15 (Dynamics), 29 (Pneumatics/Hydraulics → streaming). Phase 1 evidence partially falsifies the trade-off: HubSpot's semantic-triple rewrite shipped both lift and improved readability, suggesting structured-but-readable wins both axes when the writing craft is present."),
    ("c4_tos_clean_vs_groundtruth", "TRIZ contradiction 4: improving param 30 Object-affected Harmful Factors vs worsening param 24 Loss of Information. Matrix recommends principles 22 (Blessing in Disguise), 10 (Preliminary Action), 2 (Taking Out). Resolution: route hostile sampling through user-owned browser sessions (cursor-ide-browser Playwright) — the user's ToS-clean session becomes the ground-truth source."),
    ("c5_single_oracle_vs_multillm", "TRIZ contradiction 5: improving param 32 Ease of Manufacture vs worsening param 35 Adaptability. Matrix recommends principles 2 (Taking Out), 13 (The Other Way Around), 15 (Dynamics). Inversion: Claude CLI does not need to SEE every engine's answer — it reasons OVER per-engine evidence packets gathered cheaply by intermediaries (Playwright + RSS + Common Crawl)."),
    ("ifr_top1", "Ideal Final Result for the top-1 contradiction (measure↔act): a system in which the act of measurement IS the intervention — the same Claude CLI loop that audits a page also drafts the fix as a reviewable PR with structured data, opens it against the customer's repo, and re-audits after merge to attribute the lift. Cost: zero new infrastructure beyond what the customer already has (git, CLI subscription, browser). Side effects: zero — every action is an explicit PR awaiting human review."),
    ("ariz_85c", "ARIZ-85C deep dive on closed-loop citation engineering: Operating Zone is the customer's own content surface (page HTML, JSON-LD, internal links). Operating Time is the audit→PR→merge→re-audit cycle (24-72h). X-Resource: the customer's existing git repo + CI is the substrate; the Claude CLI is the actuator; the user's own browser sessions on AI engines are the ground-truth probes; and the GEO-paper evidence-tier ranking is the policy that picks which fix to draft first."),
]


def main() -> None:
    print("[attractor] booting Phase Space Monitor...", flush=True)
    monitor = PhaseSpaceMonitor()
    monitor.load_model()
    monitor.set_goal(GOAL)

    lyap = LyapunovEstimator(window=8)
    classifier = AttractorClassifier()
    bifurc = BifurcationDetector()

    out = {
        "session_id": "llm-seo-lab",
        "phase": 2,
        "goal": GOAL,
        "steps": [],
    }

    ftle_history = []
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
                "bifurcation_confidence": round(bifurc_result.confidence, 3) if bifurc_result.detected else 0.0,
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
        print(f"[attractor] step {rec.step_index:>2} {label:<28} ftle={step_info.get('ftle')} regime={step_info['regime']} goal_d={step_info.get('goal_distance')} bifurc={step_info['bifurcation']}", flush=True)

    out_path = ROOT / "docs" / "triz" / "attractor-trajectory.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[attractor] wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
