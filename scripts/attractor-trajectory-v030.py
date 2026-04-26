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
"""attractor-trajectory-v030.py — v0.3.0 R2 trajectory for the citation-pull charter.

Records each candidate citation-pull principle (Atomic-Snippet Density,
Semantic-Anchor Stability, Q-Shaped Subhead Lattice, Cross-Engine
Intermediary, Inverted Retrieval Target, Substrate-Authentic Voice) as a
step in the attractor-flow phase space, with the v0.3.0 IFR sentence as
the goal anchor. Emits docs/triz/v0.3.0-pull-attractor.json.

Read alongside docs/triz/v0.3.0-pull-finalists.md and
docs/decisions/2026-04-26-citation-pull-charter.md.
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
    "A system that, when a user adds any owned content URL — git-backed page, Substack post, "
    "YouTube video, hosted CMS — produces substrate-aware recommendations that creatively pull "
    "AI-engine citations to that page, accepts the user's own observations from any engine and "
    "analytics platform as the source of truth for whether the recommendation worked, and uses "
    "the resulting time series to converge on better recommendations on the next iteration. "
    "Zero scraping, zero auto-publish, zero benchmark dependency. Every action is human-triggered. "
    "Every observation is human-supplied."
)

STEPS: list[tuple[str, str]] = [
    (
        "v030_baseline",
        "v0.2.0 framing: audit a customer's site against competitor citation gaps, draft a PR "
        "diff, open the PR, re-measure citation share against those competitors. Works only for "
        "git-backed sites. Cannot move a Substack post or a YouTube video. Implicitly assumes "
        "the customer competes with named-domain incumbents on a single substrate. Cannot "
        "explain why Wikipedia/Reddit/news outlets dominate citations even when their content "
        "is shallower than the customer's.",
    ),
    (
        "candidate_atomic_snippet_density",
        "Atomic-Snippet Density (TRIZ #26 Copying): rewrite each page so every citable claim is "
        "an atomically-complete unit — origin, scope, evidence, recency — under 120 words, with "
        "a stable id and a Q-shaped subhead that names the question it answers. The page "
        "becomes a copy-target for any engine retriever: each atomic unit is a CDN-style copy "
        "of the kind of structurally-citable fragment Wikipedia ships natively. Substrate-"
        "agnostic: works on web, Substack, YouTube pinned-comment, YouTube description. TRIZ "
        "score: 4 on substrate-independence vs authority-dependence (Full IFR).",
    ),
    (
        "candidate_semantic_anchor_stability",
        "Semantic-Anchor Stability (TRIZ #28 Mechanics Substitution): replace mechanical text-"
        "matching anchors (URL fragments, sentence-position offsets) with semantic anchors — "
        "named concepts the engine retriever finds via embedding similarity rather than literal "
        "string match. The anchor survives a re-write of the surrounding prose; engines that "
        "re-index the page on a new schedule still resolve the same anchor to the same atomic "
        "answer. Composes with Atomic-Snippet Density (anchors point to snippets). TRIZ score: "
        "4 on retrieval-stability vs content-iteration (Full IFR).",
    ),
    (
        "candidate_qshaped_subhead_lattice",
        "Q-Shaped Subhead Lattice (TRIZ #17 Another Dimension): move from prose-heading axis "
        "(topic-shaped subheads like 'Background') to question-shaped subhead axis ('What is X?', "
        "'Why does X matter?', 'How do you do X?'). Engines retrieve by semantic similarity to "
        "user prompts, which are themselves Q-shaped. By indexing the page along the Q axis we "
        "shorten the retrieval distance from any plausible engine prompt to the relevant atomic "
        "snippet. Adds a literal new axis — the page is now organised by question, not by "
        "topic. TRIZ score: 4 on retrieval-yield vs reading-flow (resolved by Separation in "
        "space: questions in the heading layer, prose in the body layer).",
    ),
    (
        "candidate_cross_engine_intermediary",
        "Cross-Engine Intermediary (TRIZ #24 Intermediary): place a small in-page mediator "
        "between the content and any engine retriever — a JSON-LD `FAQPage` block that mirrors "
        "the Q-shaped subheads and atomic snippets, plus a hidden-but-visible `<dl>` definition "
        "list with the same content, plus an OpenGraph block tuned for retriever previews. The "
        "intermediary translates one canonical content source into the formats every engine's "
        "retriever expects, without forcing the page to commit to any one engine's preferred "
        "schema. TRIZ score: 4 on multi-engine-yield vs maintenance-cost (Full IFR — the "
        "intermediary is generated from the canonical Q-shaped lattice, not hand-maintained).",
    ),
    (
        "candidate_inverted_retrieval_target",
        "Inverted Retrieval Target (TRIZ #13 The Other Way Around): stop pushing the page out "
        "to engines (sitemaps, ping endpoints, link-building) and instead make the page the "
        "kind of pull target engines actively want. The page becomes the answer engines would "
        "construct if they had to write the page themselves — same lattice, same density, same "
        "anchors, same intermediary. Pull replaces push; the substrate's domain-authority "
        "deficit becomes irrelevant because the page is being chosen on retrieval-fit, not on "
        "domain prior. TRIZ score: 3 on substrate-authority vs retrieval-fit — strong but not "
        "Full IFR because some engines weight domain prior heavily and inversion alone cannot "
        "override that for very-low-authority substrates without also satisfying density and "
        "anchor stability.",
    ),
    (
        "candidate_substrate_authentic_voice",
        "Substrate-Authentic Voice (TRIZ #35 Parameter Changes): vary voice/tone parameters by "
        "substrate — clinical-and-cited on web, conversational-and-anecdotal on Substack, "
        "scripted-and-timestamped on YouTube — while keeping the underlying lattice + atomic "
        "snippets + semantic anchors the same. Voice is the means, not the end: it controls "
        "which audiences click through after the engine surfaces the page. Without it, atomic "
        "snippets read as inhuman and reduce trust. TRIZ score: 3 on voice vs retrieval-"
        "structure (resolved by Separation in space — voice in the prose layer, structure in "
        "the lattice layer).",
    ),
    (
        "verdict",
        "ADOPT Atomic-Snippet Density + Semantic-Anchor Stability + Q-Shaped Subhead Lattice + "
        "Cross-Engine Intermediary + Inverted Retrieval Target as the five charter principles "
        "of v0.3.0 citation-pull. CONSUME Substrate-Authentic Voice as a per-substrate-adapter "
        "concern — the adapter applies the voice parameter to the lattice. The pull-orchestrator "
        "agent owns the recommend → apply → measure → analyze cycle and is parameterised by the "
        "five charter principles. The five compose: density supplies the units; anchors supply "
        "stability; the lattice supplies the question-axis; the intermediary supplies cross-"
        "engine portability; inversion supplies the substrate-independence story.",
    ),
]


def main() -> None:
    print("[attractor-v030] booting Phase Space Monitor...", flush=True)
    monitor = PhaseSpaceMonitor()
    monitor.load_model()
    monitor.set_goal(GOAL)

    lyap = LyapunovEstimator(window=8)
    classifier = AttractorClassifier()
    bifurc = BifurcationDetector()

    out: dict[str, object] = {
        "session_id": "llm-seo-lab",
        "phase": "v0.3.0-R2",
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
            f"[attractor-v030] step {rec.step_index:>2} {label:<38} "
            f"ftle={step_info.get('ftle')} regime={step_info['regime']} "
            f"goal_d={step_info.get('goal_distance')} bifurc={step_info['bifurcation']}",
            flush=True,
        )

    out_path = ROOT / "docs" / "triz" / "v0.3.0-pull-attractor.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[attractor-v030] wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
