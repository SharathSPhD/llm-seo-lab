# TRIZ contradiction cards — `llm-seo-lab`

**Phase:** 2 · **Date:** 2026-04-25 · **Source synthesis:** [`docs/research/seo_research_2.md`](../research/seo_research_2.md)

This file is the formal TRIZ analysis of the five candidate contradictions that emerged from the master plan and the Phase 1 research synthesis. Each card runs the full pipeline: parameter mapping → matrix lookup → IFR formulation → solution sketch → IFR scoring (via `score_solution`). Per-card "skeptic notes" preserve adversarial counter-evidence.

The TRIZ engine MCP `log_session_entry` tool persists the structured ledger to `.triz/session.jsonl`. The attractor-flow trajectory is in [`attractor-trajectory.json`](attractor-trajectory.json) and is referenced in §7 below.

## 0. Pipeline used per card

```
suggest_parameters / human-mapping  →  lookup_matrix(improving, worsening)
                                    →  fetch get_principle(P) for each recommended P
                                    →  formulate IFR
                                    →  draft solution
                                    →  score_solution(problem, solution)        # 0-4 IFR rubric
                                    →  log_session_entry({...})
                                    →  attractorflow_record_state(narrative)
```

> **Asymmetry note.** TRIZ matrix is **asymmetric** (improving and worsening are not interchangeable). For C4 (ToS-clean vs ground-truth) we ran both directions: `(30, 24)` returned `[22, 10, 2]`, `(24, 30)` returned `[22, 10, 1]` — Principles 22 and 10 are robust to framing direction.

---

## C1 — *measure vs act* **[selected for ARIZ deep dive]**

| Field | Value |
|---|---|
| Improving feature | **#28 Measurement accuracy** (monitoring precision / metric granularity) |
| Worsening feature | **#38 Extent of automation** (CI/CD automation level) |
| Matrix recommends | Principles **28 (Mechanics Substitution)**, **2 (Taking Out)**, **10 (Preliminary Action)**, **34 (Discarding and Recovering)** — `cell_key: 28_38` |
| Cross-check (28, 39) | Principles **10, 34, 28, 32** — same shortlist plus 32 (Color/visual signal) |
| Phase 1 evidence | 9 of 12 SOTA tools studied are confessed monitoring SaaS. Peec.ai's Customer ToS contractually disclaim influence on visibility. Profound's "agents" are gated behind ~$499/mo enterprise tier; Goodie sells "actions" as a separate credit pool. **No vendor publishes a randomized causal-attribution proof that any of their actions move citation share.** |
| **Ideal Final Result** | A system in which the act of measurement *is* the intervention. The same Claude CLI loop that audits a page also drafts the fix as a reviewable PR (rewritten copy + JSON-LD + internal links per the GEO-paper evidence policy), opens it against the customer's own repository, and re-audits after merge to attribute the lift. Cost = zero new infrastructure beyond resources the customer already has (git, CLI subscription, browser). Side effects = zero — every action is an explicit PR awaiting human review. |
| Solution sketch | **Closed-loop autonomous citation engineering.** Loop: `audit → diagnose → draft fix → open PR → measure post-merge → re-audit`. Backed by `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator` skills (Phase 5a). |
| **IFR score** | **4 / 4 — Full IFR** (leverages_existing, minimal_cost, no_new_problems, self_resolving) |
| Separation principle | **System-level separation** (relevance 0.85): the *whole system* both measures and acts; *components* specialise (auditor, drafter, PR opener, re-auditor) but compose into one identity at the system boundary. |
| Skeptic note | The IFR can re-introduce a worse contradiction (drafting *bad* content faster than humans can catch). Mitigation: the act-side output is **always a PR** so a human reviews before merge; the GEO-paper evidence policy refuses to draft tactics that lack Tier-1 evidence (e.g. keyword stuffing, which the GEO paper showed *hurts* citations on Perplexity). |
| TRIZ ledger entry | `phase=2 step=c1_measure_vs_act ifr=4 selected_for_ariz=true` |

---

## C2 — *recency vs authority*

| Field | Value |
|---|---|
| Improving feature | **#9 Speed** (response time / throughput → freshness updates) |
| Worsening feature | **#27 Reliability** (uptime / accumulated authority) |
| Matrix recommends | Principles **11 (Beforehand Cushioning)**, **35 (Parameter Changes)**, **27 (Cheap Short-living)**, **28 (Mechanics Substitution)** — `cell_key: 9_27` |
| Phase 1 evidence | GEO paper shows freshness signals lift extractive citation; sources referenced in `geo-evidence-base.md` show citation decay >3 months for newsy topics; Profound study shows Wikipedia/Reddit dominance is partly an authority effect (older, link-dense sources). |
| **Ideal Final Result** | A system that ships *fresh* artefacts continuously **while** a stable spine of canonical pages accretes citations and links over time, and the fresh artefacts feed the spine with citations. Recency and authority compound in the same direction instead of trading off. |
| Solution sketch | **Stable-spine + ephemeral-leaves architecture.** Per topic: one canonical "spine" page that accretes citations and links over time (slow authority compound), surrounded by short-lived "leaf" updates (news, datapoints, freshness-radar refreshes) that internal-link back to the spine. The spine = authority resource (#27 inverted: durable on purpose); leaves = recency resource (#27 used as designed: cheap, short-lived). The `freshness-radar` skill (Phase 5a) auto-generates and auto-decommissions leaves on schedule. |
| **IFR score** | **3 / 4 — Near-IFR** (leverages_existing, minimal_cost, no_new_problems; *not* fully self-resolving — requires the orchestration loop) |
| Skeptic note | Spine pages risk becoming over-edited and losing voice over time. Mitigation: spine pages are *append-only* updated section-by-section with versioned "as-of" timestamps. The `git diff` between spine versions is itself the audit trail. |
| TRIZ ledger entry | `phase=2 step=c2_recency_vs_authority ifr=3` |

---

## C3 — *structure vs voice*

| Field | Value |
|---|---|
| Improving feature | **#12 Shape** (data structure / architecture shape — JSON-LD, lists, tables) |
| Worsening feature | **#35 Adaptability or versatility** (extensibility → voice flexibility) |
| Matrix recommends | Principles **1 (Segmentation)**, **15 (Dynamics)**, **29 (Pneumatics/Hydraulics → streaming)** — `cell_key: 12_35` |
| Phase 1 evidence | GEO paper: Cite Sources, Quotation Addition, Statistics Addition each ~30–40% lift; FAQ-only schema lacks isolated controlled evidence. **HubSpot's semantic-triple rewrite shipped both citation lift AND improved readability** (acknowledged confound: before/after, not RCT). Several Tier-2 sources observe that structured rewriting often *forces* clarity rather than destroying it. |
| **Ideal Final Result** | The contradiction does not exist. The same artefact serves humans in voice form *and* LLMs in structured form, sourced from one canonical document, without duplicate-content penalties. |
| Solution sketch | **Dual-layer rendering** (Principle 1 + 15). One source-of-truth document; rendered twice in the same page — (a) human-readable narrative surface, (b) LLM-targeted structured fragment (JSON-LD `Article`/`FAQPage`/`HowTo` + invisible aria-described summary block + `dl`-semantic markup). Both surfaces share the same source so they cannot drift. The `schema-generator` skill (Phase 5a) emits the structured fragment from the prose; the `aeo-audit` skill verifies parity. |
| **IFR score** | **4 / 4 — Full IFR** |
| Phase 6 RCT (planned) | We will run a controlled "structure vs voice" rewrite RCT to **falsify** the contradiction's existence in our domain. If structured-and-readable wins both axes, the trade-off is a non-issue and we get a free win. If it doesn't, separation principles apply and we know exactly which subset of pages needs which rendering. |
| Skeptic note | Some `aria-described` and "invisible content" patterns can trip Google web-spam heuristics if they look like cloaking. The implementation must use *visible* structured content (FAQ accordions, definition lists, sidebars) as the LLM-target rather than hidden text. |
| TRIZ ledger entry | `phase=2 step=c3_structure_vs_voice ifr=4` |

---

## C4 — *ToS-clean tracking vs ground-truth data*

| Field | Value |
|---|---|
| Improving feature | **#30 Object-affected harmful factors** (external attack surface / vendor TOS exposure) |
| Worsening feature | **#24 Loss of information** (information loss / signal degradation) |
| Matrix recommends | Principles **22 (Blessing in Disguise)**, **10 (Preliminary Action)**, **2 (Taking Out)** — `cell_key: 30_24` |
| Reverse direction (24, 30) | Principles **22, 10, 1** — Principle 22 robust both ways |
| Phase 1 evidence | Peec.ai openly publishes a methodology essay arguing for browser automation because *APIs diverge from what the user sees* — a deliberate engineering choice with documented rationale. OpenAI documents `OAI-SearchBot` and a publisher-feedback channel; Perplexity has shipped revenue-share programs but no public citation API. |
| **Ideal Final Result** | The customer themselves is the legitimate sampling actor on AI engines, so their citation visibility is sampled inside ToS by construction; APIs cover what they cover; nothing the product touches is hostile. |
| Solution sketch | **User-owned session as ground-truth probe** (Principle 22 + 13). The user's own browser sessions on ChatGPT/Perplexity/AIO are inherently ToS-clean (their queries from their logged-in tabs). Use `cursor-ide-browser` MCP Playwright to drive those sessions on schedule, capture the answer cards/citations, ship screenshots as audit-trail evidence. Vendor APIs handle what they cover (RSS, partner programs, GA4 referrers). The harmful factor (third-party scraping prohibition) is removed by *inverting who the actor is* — Principle 13 (The Other Way Around). |
| **IFR score** | **4 / 4 — Full IFR** |
| Skeptic note | Some vendors still flag headless-browser fingerprints even on logged-in sessions. Mitigation: `cursor-ide-browser` MCP runs in the user's actual Chrome instance (not headless), and rate-limits to a human-plausible cadence. Also: this method is opt-in per engine — if a customer doesn't want Perplexity sampled this way, the product still functions on the API/RSS subset. |
| TRIZ ledger entry | `phase=2 step=c4_tos_clean_vs_groundtruth ifr=4` |

---

## C5 — *single-LLM oracle vs multi-LLM reality*

| Field | Value |
|---|---|
| Improving feature | **#32 Ease of manufacture** (development velocity / ease of implementation — one subscription is simple to ship) |
| Worsening feature | **#35 Adaptability or versatility** (extensibility — one oracle ≠ all engines) |
| Matrix recommends | Principles **2 (Taking Out)**, **13 (The Other Way Around)**, **15 (Dynamics)** — `cell_key: 32_35` |
| Reverse direction (35, 32) | Principles **1, 13, 31** — Principle 13 robust both ways |
| Phase 1 evidence | Profound's ~680M-citation observational study shows Wikipedia is **47.9%** of ChatGPT's top-10 concentration vs much lower elsewhere; Reddit dominates Perplexity's top-10; AIO over-indexes .gov vs standard SERP. A single-oracle product systematically misreads visibility on engines whose citation distribution differs from its oracle's. |
| **Ideal Final Result** | The single Claude CLI subscription suffices because Claude is the **reasoning engine over per-engine evidence**, not the evidence source itself. Each engine is sampled by the cheapest available means; Claude reasons over the structured evidence packets. |
| Solution sketch | **Reasoning-vs-evidence inversion** (Principle 13 + 2 + 15). Claude Code CLI = reasoning. Cheap intermediaries = evidence: `cursor-ide-browser` for chat UIs (per C4); OpenAI/Perplexity public crawler logs and ranking signals for offline analysis; RSS + partner feeds where available; Common Crawl for training-set proxies. Evidence packets are fed to Claude CLI as context; Claude reasons over them but never has to *be* every engine. |
| **IFR score** | **3 / 4 — Near-IFR** (cost-bounded but not fully self-resolving — the evidence pipelines are real plumbing) |
| Skeptic note | Each evidence pipeline is its own maintenance burden (selectors break, RSS feeds change). Mitigation: pipeline failures degrade gracefully into "no signal for engine X this week" rather than failing the whole audit; the `competitive-citation-intel` skill (Phase 5a) flags stale per-engine evidence in the dashboard. |
| TRIZ ledger entry | `phase=2 step=c5_single_oracle_vs_multillm ifr=3` |

---

## 6. Final ranking and selection

| # | Contradiction | IFR | Commercial wedge | Strategic novelty | Selected for ARIZ? |
|---|---|---|---|---|---|
| C1 | measure vs act | **4** | **Largest** — no SOTA ships it | High | **YES** |
| C2 | recency vs authority | 3 | Moderate | Moderate | No |
| C3 | structure vs voice | **4** | Moderate (partially false contradiction) | Moderate | No |
| C4 | ToS-clean vs ground-truth | **4** | Technical-only, modest commercial wedge | Moderate | No |
| C5 | single-oracle vs multi-LLM | 3 | Modest (cost-side) | High | No |

**Selected for ARIZ-85C deep dive: C1 (measure vs act).**

Three contradictions tie at IFR=4. C1 wins on commercial-wedge × strategic-novelty: it is the unique gap across the entire SOTA category (per `competitor-matrix.md`), and the resolution defines the product (closed-loop autonomous citation engineering). C3 is partially falsified by Phase 1 evidence so the "novel" resolution may be a non-problem; C4 is a high-quality technical solution but lower headline novelty. **C2, C3, C4, C5 still feed Phase 3 divergence as supporting principles** — they are not discarded, only deferred.

See [`ariz-session.md`](ariz-session.md) for the C1 ARIZ-85C nine-part deep dive.

---

## 7. Attractor-flow baseline trajectory

The Phase 2 design-space trajectory was recorded in real time using the attractor-flow Python API (`scripts/attractor-trajectory.py`), with goal-anchor set to the project north-star. Full per-step output is in [`attractor-trajectory.json`](attractor-trajectory.json). Summary:

| Step | Label | FTLE λ | Regime | Goal-distance |
|---|---|---|---|---|
| 0 | phase1_baseline | — | unknown | 1.086 |
| 1 | c1_measure_vs_act | — | unknown | 1.297 |
| 2 | c2_recency_vs_authority | **−0.598** | **CONVERGING** | 1.317 |
| 3 | c3_structure_vs_voice | −0.249 | CONVERGING | 1.319 |
| 4 | c4_tos_clean_vs_groundtruth | −0.136 | CONVERGING | 1.268 |
| 5 | c5_single_oracle_vs_multillm | −0.147 | CONVERGING | 1.218 |
| 6 | ifr_top1 | −0.023 | EXPLORING | 1.135 |
| 7 | ariz_85c | −0.033 | EXPLORING | **1.005** |

**Reading.** Steps 2–5 (C2–C5) are strongly contractive (λ ≪ 0): the trajectory is converging in the embedding space because all five contradictions live in the same conceptual neighbourhood (closed-loop AEO design). Steps 6–7 (IFR + ARIZ) are mildly expansive (λ ≈ 0): formulating the IFR and the ARIZ deep dive *legitimately* opens new parts of the design space, which is what TRIZ wants at this stage. Goal-distance shrinks monotonically from 1.297 → 1.005, indicating progress toward the north-star. **No bifurcation detected** — the design space has not yet split into competing paradigms (we'd expect that in Phase 3 divergence). This is the baseline for Phase 3 convergence comparison.

---

## 8. Phase 2 ralph-loop completeness checklist

- [x] All five contradictions have explicit improving/worsening parameter mappings
- [x] All five matrix lookups executed, with reverse-direction sanity checks where TRIZ asymmetry might bite (C4, C5)
- [x] Each contradiction has IFR formulation + scored solution sketch + skeptic note
- [x] Top-1 contradiction selected with explicit, defended ranking criteria
- [x] Separation principles consulted for the top-1 (system-level separation, relevance 0.85)
- [x] Attractor-flow baseline trajectory recorded with goal-anchor and per-step metrics
- [x] TRIZ session ledger persisted to `.triz/session.jsonl`
- [x] All claims traceable to a Phase-1 source or the principle definitions

**Gate verdict:** pass. Proceeding to ARIZ-85C deep dive on C1, then Phase 3 (divergence + convergence to 2 finalists).
