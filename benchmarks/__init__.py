"""llm-seo-lab benchmark harness.

Modules:
    questions/  Deterministic question-bank generator.
    engines/    Engine adapters (Claude CLI, Playwright, simulation).
    treatments/ Treatment definitions (baseline, athenahq_style, profound_style, llm_seo_lab).
    runner/     Orchestrator that produces JSONL event logs under benchmarks/runs/.
    analysis/   Statistical pipeline: power analysis, two-proportion z-test,
                Bonferroni, bootstrap CIs, Cohen's h, results renderer.
"""
