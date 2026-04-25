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
attractor-convergence.py — Phase 3 attractor convergence over 8 sketches.

For each candidate sketch, simulate a 4-step elaboration trajectory through
phase space, compute Lyapunov FTLE and basin depth, then inject regime-
appropriate perturbations on the top candidates to test robustness.

Outputs:
    docs/triz/attractor-convergence.json  — per-sketch metrics
    docs/triz/attractor-convergence.md    — human-readable summary
"""

from __future__ import annotations
import json
import sys
from pathlib import Path
from statistics import variance, mean

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
    "and validated statistically against SOTA tools on indie sites."
)

# Each sketch = (id, headline, [4 elaboration steps that flesh it out]).
# The 4 steps are NOT the same per sketch — they are the natural next 4
# things the sketch implies (architecture, edge case, failure mode, win).
SKETCHES = {
    "S1": {
        "headline": "PR-as-product. The Claude CLI loop audits the customer's repo, drafts the fix as a feature-branch commit, opens a PR with diff plus GEO-paper evidence plus revert plan, then re-audits after merge. Customer reviews and merges as for any code change.",
        "steps": [
            "Architecture: a daemon clones the customer repo, runs aeo-audit per page, drafts edits to JSON-LD + meta + headings + sitemap, commits to feature/aeo-NNN, opens PR via gh CLI with embedded GEO-paper citation evidence and a one-click revert link.",
            "Edge: sites without a git repo (Substack, GitHub Pages from external CMS) are handled via a thin shim repo that mirrors the published HTML and proposes patches as Substack drafts or PR-against-mirror.",
            "Failure mode: if a PR sits unmerged for 14 days the daemon downgrades to advisory mode and surfaces the gap in the dashboard with a 'why this matters' explanation tied to the GEO-paper tier.",
            "Win condition: a merged PR is the metric. Citation lift is attributed to merged PRs only, with 14-day pre/post measurement per engine and bootstrap CIs.",
        ],
    },
    "S2": {
        "headline": "IDE-native autopilot. Everything inside the Cursor IDE plugin. No web dashboard. Plugin surfaces gaps as inline diagnostics, drafts fixes as proposed edits in the open file, customer accepts/rejects with a click. Reuses file tree, diff view, git integration.",
        "steps": [
            "Architecture: a Cursor plugin with a single command 'aeo: audit current file' plus an MCP server exposing audit, citation tracker, and brief generator; fixes appear as proposed edits the customer accepts via the existing diff UI.",
            "Edge: non-developer customers (marketers using Substack, Webflow, Ghost) cannot use Cursor; this sketch addresses only the developer-customer segment.",
            "Failure mode: cross-file refactors (sitemap regeneration, internal-link injection across many files) exceed the inline-diff UX; a fallback 'open as PR' option is required.",
            "Win condition: time-to-first-fix under 60 seconds inside the editor, measured as acceptance count per session.",
        ],
    },
    "S3": {
        "headline": "Dashboard with one-click apply. Standard SaaS dashboard like AthenaHQ but every recommendation tile has an Apply button that opens a PR via GitHub OAuth. Customer reviews and merges in GitHub.",
        "steps": [
            "Architecture: Next.js app on Vercel with GitHub OAuth scope on the customer's chosen repo; recommendation tiles rendered server-side; Apply button calls a server action that opens a PR.",
            "Edge: subscription cost basis is the dashboard hosting + Claude CLI worker; pricing must absorb both, raising the floor above the AthenaHQ $99 anchor unless the worker runs on the customer's machine.",
            "Failure mode: customers who don't grant repo write access fall back to a download-patch flow, which is the same friction AthenaHQ has today.",
            "Win condition: weekly active applies per customer, benchmarked against AthenaHQ reported applies.",
        ],
    },
    "S4": {
        "headline": "Continuous-deployment swarm. Many small ephemeral micro-PRs (tens per week) that A/B test themselves. Each micro-PR ships to one page or sub-segment, the system measures per-engine citation lift over 7 days, then auto-keeps or auto-reverts. Reuses customer's CI and feature-flag system.",
        "steps": [
            "Architecture: per-page experiments with feature flags; the citation-lift signal feeds a thompson-sampling allocator that picks which experiments to keep running, scale up, or revert.",
            "Edge: 7-day lift measurement on a single page is statistically underpowered for any but the most-cited engines; the swarm needs to aggregate across pages of the same topic to gain power.",
            "Failure mode: search engines see frequent rewrites of the same URL and can downrank as 'unstable content'; mitigation requires sticky URLs with versioned content.",
            "Win condition: aggregate citation lift across the swarm with auto-revert ratio under 30%.",
        ],
    },
    "S5": {
        "headline": "Inversion: AI engines come to you. Customer publishes llms.txt plus enriched sitemap plus content firehose (RSS, Atom, IndexNow) optimised per the GEO-paper evidence policy. AI crawlers (OAI-SearchBot, PerplexityBot, ClaudeBot, GoogleBot) self-discover and ingest. Tracking via existing GA4 referrer data and server logs.",
        "steps": [
            "Architecture: a static-asset generator that publishes llms.txt, llms-full.txt, sitemap.xml, atom feeds, IndexNow pings; a server-log analyser that classifies crawler hits and infers per-engine ingestion latency.",
            "Edge: no measurement of which content was used in which answer; only ingestion is observable, not citation. Closing this loop requires a separate sampling oracle (Claude CLI or Playwright).",
            "Failure mode: if the customer's CDN strips referrers or blocks AI crawlers (technektar.dev's robots.txt currently does this), the entire inversion fails until the robots.txt is fixed.",
            "Win condition: time-to-ingestion per engine measured via server logs, plus delta in citation share measured by the sampling oracle.",
        ],
    },
    "S6": {
        "headline": "Spine-and-leaves CMS layer. CMS plugin (WordPress, Ghost, Substack, Webflow, headless API) maintains one canonical spine page per topic and auto-generates short-lived leaf pages on schedule. CMS UI is the action surface.",
        "steps": [
            "Architecture: per-CMS plugins that read the topic spine, generate leaves on a cron, and surface the audit + recommendations inside the CMS admin UI.",
            "Edge: connector explosion (WordPress + Ghost + Substack + Webflow + Squarespace + Webflow + headless) is a multi-quarter build, far beyond the 8-12 week single-dev budget.",
            "Failure mode: leaf-page proliferation creates duplicate-content / canonical-tag SEO issues if not carefully governed; the system must auto-canonicalise to the spine.",
            "Win condition: per-CMS install count and citation lift attributable to leaves.",
        ],
    },
    "S7": {
        "headline": "Federated benchmark co-op. Customers share anonymised citation outcomes (which fixes worked on which engines for which topics) into a federated benchmark. The system uses the federated prior to predict per-customer lift before shipping a fix.",
        "steps": [
            "Architecture: opt-in federated database; each customer's audit emits anonymised topic+fix+lift triples; the recommendation engine queries the federated prior to rank fixes by predicted lift.",
            "Edge: cold start. Until many customers have run many cycles, the federated prior is too thin to outperform a static GEO-paper-derived prior.",
            "Failure mode: privacy or competitive concerns may make customers opt out of sharing, collapsing the network effect.",
            "Win condition: lift prediction accuracy versus held-out outcomes, plus customer-reported confidence in the prior.",
        ],
    },
    "S8": {
        "headline": "Editorial-trust marketplace. PRs from the autonomous loop are reviewed by a network of paid trusted editors (a marketplace) who get a cut of the subscription. The customer chooses an editor tier; PRs are pre-vetted before reaching the customer.",
        "steps": [
            "Architecture: a two-sided marketplace with an editor signup/onboarding/payment side and a customer-side editor selection; PRs queue to the chosen editor with SLA.",
            "Edge: marketplace bootstrap (cold start of editors and customers in parallel) is a notoriously hard problem and not feasible for a solo 8-12 week build.",
            "Failure mode: editor bias or inconsistency reintroduces variance the autonomous loop was meant to remove.",
            "Win condition: editor-approved-PR throughput per customer, customer satisfaction with editor quality.",
        ],
    },
}

# Perturbations: domain-specific stress tests applied AFTER the 4 elaboration steps.
PERTURBATIONS = {
    "S1": "PERTURBATION: customer fully blocks all AI crawlers in robots.txt and refuses to merge any PR that touches robots.txt. Re-evaluate.",
    "S2": "PERTURBATION: customer is a non-developer marketer publishing on Substack with no IDE installed and no git workflow. Re-evaluate.",
    "S5": "PERTURBATION: customer's CDN strips all referrer headers and the customer cannot deploy server-side log analytics. Re-evaluate.",
}


def simulate(monitor: PhaseSpaceMonitor, lyap: LyapunovEstimator,
             classifier: AttractorClassifier, bifurc: BifurcationDetector,
             texts: list[str]):
    ftle_history = []
    regime_history = []
    last_classification = None
    for t in texts:
        monitor.record(t)
        stats = monitor.get_stats()
        distances = monitor.get_distance_series()
        embeddings = monitor.get_embeddings_matrix()
        if len(distances) >= 2:
            lya = lyap.compute(distances, embeddings_matrix=embeddings)
            cls = classifier.classify(lya, stats)
            ftle_history.append(lya.ftle)
            regime_history.append(cls.regime)
            last_classification = cls
    return monitor, ftle_history, regime_history, last_classification


def basin_depth_score(distances: list[float]) -> dict:
    if len(distances) < 2:
        return {"basin_depth": 0.0, "stability": "unknown",
                "variance_of_distances": 0.0,
                "mean_distance": 0.0, "trend": 0.0}
    var = variance(distances)
    mn = mean(distances)
    trend = (distances[-1] - distances[0]) / max(len(distances) - 1, 1)
    raw = 1.0 / (1.0 + var * 10 + mn * 2)
    if trend < 0:
        raw = min(1.0, raw * 1.3)
    elif trend > 0.01:
        raw = max(0.0, raw * 0.7)
    if raw > 0.7:
        stab = "deep"
    elif raw > 0.4:
        stab = "moderate"
    elif raw > 0.2:
        stab = "shallow"
    else:
        stab = "unstable"
    return {"basin_depth": round(raw, 3), "stability": stab,
            "variance_of_distances": round(var, 4),
            "mean_distance": round(mn, 4), "trend": round(trend, 4)}


def main() -> None:
    print("[converge] booting...", flush=True)
    out = {"goal": GOAL, "sketches": {}}

    for sid, sk in SKETCHES.items():
        print(f"[converge] === {sid} ===", flush=True)
        monitor = PhaseSpaceMonitor()
        monitor.load_model()
        monitor.set_goal(GOAL)
        lyap = LyapunovEstimator(window=8)
        classifier = AttractorClassifier()
        bifurc = BifurcationDetector()

        texts = [sk["headline"]] + sk["steps"]
        monitor, ftle_hist, regime_hist, last_cls = simulate(
            monitor, lyap, classifier, bifurc, texts)
        stats = monitor.get_stats()
        depth = basin_depth_score(stats.distances)

        record = {
            "headline": sk["headline"][:140] + ("..." if len(sk["headline"]) > 140 else ""),
            "n_steps": len(texts),
            "ftle_final": round(ftle_hist[-1], 4) if ftle_hist else None,
            "ftle_mean": round(sum(ftle_hist) / len(ftle_hist), 4) if ftle_hist else None,
            "regime_final": last_cls.regime.value if last_cls else "unknown",
            "regime_confidence": round(last_cls.confidence, 3) if last_cls else 0.0,
            "action": last_cls.action.value if last_cls else "unknown",
            "rationale": last_cls.rationale if last_cls else "",
            "goal_distance_initial": round(stats.goal_distances[0], 4) if stats.goal_distances else None,
            "goal_distance_final": round(stats.goal_distances[-1], 4) if stats.goal_distances else None,
            "basin_depth": depth,
            "perturbation": None,
        }

        if sid in PERTURBATIONS:
            print(f"[converge]    perturbing {sid}", flush=True)
            pre_distance = stats.goal_distances[-1]
            pre_regime = last_cls.regime.value if last_cls else "unknown"
            monitor.record(PERTURBATIONS[sid])
            stats2 = monitor.get_stats()
            distances2 = monitor.get_distance_series()
            embeddings2 = monitor.get_embeddings_matrix()
            lya2 = lyap.compute(distances2, embeddings_matrix=embeddings2)
            cls2 = classifier.classify(lya2, stats2)
            post_distance = stats2.goal_distances[-1]
            recovery = pre_distance - post_distance
            record["perturbation"] = {
                "stress_text": PERTURBATIONS[sid][:120],
                "pre_distance": round(pre_distance, 4),
                "post_distance": round(post_distance, 4),
                "delta": round(post_distance - pre_distance, 4),
                "recovery": round(recovery, 4),
                "pre_regime": pre_regime,
                "post_regime": cls2.regime.value,
                "post_ftle": round(lya2.ftle, 4),
                "robust": (post_distance - pre_distance) < 0.1,
            }

        out["sketches"][sid] = record
        print(f"[converge] {sid} ftle={record['ftle_final']} regime={record['regime_final']} basin={depth['basin_depth']} ({depth['stability']})", flush=True)

    out_json = ROOT / "docs" / "triz" / "attractor-convergence.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, indent=2))
    print(f"[converge] wrote {out_json}", flush=True)


if __name__ == "__main__":
    main()
