# Decision: which inventive principles are first-class in the v0.3.0 plugin

- **Status:** accepted
- **Date:** 2026-04-26
- **Phase:** v0.3.0 R2 of `v0.3.0_citation-pull_reorientation`
- **Inputs:**
  - [`docs/triz/v0.3.0-pull-contradictions.md`](../triz/v0.3.0-pull-contradictions.md) (TRIZ scoring, 5 contradiction cards)
  - [`docs/triz/v0.3.0-pull-ariz.md`](../triz/v0.3.0-pull-ariz.md) (ARIZ-85C deep dive on C-Pull-1)
  - [`docs/triz/v0.3.0-pull-finalists.md`](../triz/v0.3.0-pull-finalists.md) (8-sketch convergence, charter selection)
  - [`docs/triz/v0.3.0-pull-attractor.json`](../triz/v0.3.0-pull-attractor.json) (attractor-flow trajectory; FTLE / regime / goal-distance)
  - [`docs/v0.3.0/prd.md`](../v0.3.0/prd.md) (v0.3.0 PRD), [`docs/v0.3.0/spec.md`](../v0.3.0/spec.md), [`docs/v0.3.0/architecture.md`](../v0.3.0/architecture.md)
- **Pratyakṣa companion:** [`docs/triz/v0.3.0-pratyaksha-deltas.md`](../triz/v0.3.0-pratyaksha-deltas.md)

## Verdict

| Candidate | Verdict | Implementation surface |
| --- | --- | --- |
| **P1 Atomic-Snippet Density** (TRIZ #26 Copying) | **ADOPT — charter principle** | Substrate adapter `recommend()` returns a `density` block per snippet: `{snippet_id, q_subhead, body_60_120w, origin, scope, evidence, recency}`. |
| **P2 Semantic-Anchor Stability** (TRIZ #28 Mechanics Substitution) | **ADOPT — charter principle** | Substrate adapter `recommend()` emits a `semantic_anchor` per snippet: `{anchor_id (slug), concept_phrase, embedding_hint?}`. Anchors persist across iterations on the use case. |
| **P3 Q-Shaped Subhead Lattice** (TRIZ #17 Another Dimension) | **ADOPT — charter principle** | Adapter `recommend()` rewrites topic subheads into Q-form (`What is X?`, `Why does X matter?`, `How do you do X?`); `applyArtifact()` materialises them per substrate (HTML headings on web; Markdown `##` on Substack; chapter labels + pinned-comment lines on YouTube). |
| **P4 Cross-Engine Intermediary** (TRIZ #24 Intermediary) | **ADOPT — charter principle** | Adapter emits an `intermediary` block per substrate: JSON-LD `FAQPage` on web; visible post-foot FAQ digest on Substack (JSON-LD on author posts is unreliable); pinned-comment digest + chapter timestamp lines on YouTube. |
| **P5 Inverted Retrieval Target** (TRIZ #13 The Other Way Around) | **ADOPT — charter principle (framing)** | Charter framing: `pull_recommend` MUST NOT propose link-building, sitemap firehoses, or IndexNow ping campaigns. The recommendation set is page-internal only. Negative principle: enforced as a guard in `pull_recommend`'s post-validation. |
| **P6 Substrate-Authentic Voice** | **CONSUME** (per-adapter parameter, not charter) | Each substrate adapter ships a `voiceProfile` constant (web → `clinical-and-cited`; substack → `conversational-and-anecdotal`; youtube → `scripted-and-timestamped`). The voice parameter shapes only the prose-layer between snippets; the lattice/density/anchors/intermediary are voice-uniform. |
| P7 Continuous Citation-Probe Loop | **REJECT** | Violates v0.3.0 PRD non-goal "no scraping engines from the plugin". Re-considered only if a future PRD relaxes that. |
| P8 Editorial-Trust Mediator | **REJECT** | Adds a two-sided marketplace bootstrap; misaligned with solo-engineer scope. Re-considered in v0.5+ if customer demand exists. |

## Rationale

### Why these five are the charter

The TRIZ-IFR scores and the attractor-flow trajectory agree:

- **P1 Atomic-Snippet Density** is the densest source of citable units the page can emit; it converts substrate-authority deficit into retrieval-fit surplus by giving engines the same kind of compact, sourced, copy-target they would otherwise lift from Wikipedia.
- **P2 Semantic-Anchor Stability** lands at the deepest negative-FTLE basin (`-0.185`, OSCILLATING) — anchors are the structural lock; without them, density and lattice drift on every iteration. Anchors are the only charter principle that *crosses* iterations explicitly (an anchor created in iteration N persists into N+1 unless retired).
- **P3 Q-Shaped Subhead Lattice** is the orthogonal axis (TRIZ #17) the page lives along after the charter is applied. Engines retrieve along the Q axis at the embedding level; users still read along the topic axis at the prose level. The two axes coexist in space.
- **P4 Cross-Engine Intermediary** has the lowest goal-distance in the trajectory (`1.082`) — it is where the canonical lattice meets the engine schema layer in practice. The intermediary is generated *from* the lattice + density + anchors; it is not a separate authoring task.
- **P5 Inverted Retrieval Target** scored 3/4 on TRIZ-IFR (one shy of full) because it is a *framing*, not an actuator. As the framing, it is the negative principle that guards the other four — it forbids the SEO-style "push more, link more, ping more" tactics that would turn the plugin into a lower-tier monitoring SaaS clone.

The five compose into a single coherent attractor (`bifurcation_proximity` peaks at 0.37, well below the 0.7 threshold for paradigm split — see [`v0.3.0-pull-attractor.json`](../triz/v0.3.0-pull-attractor.json) step 6 metadata).

### Why P6 Substrate-Authentic Voice is consumed, not adopted

P6 scored 3/4 on TRIZ-IFR and 70/100 on the evaluator — strong but not strong enough to elevate to charter status. The attractor-flow signal is decisive: at step 6 the trajectory shifts to EXPLORING regime with shallow λ (`-0.026`) — voice intentionally drifts away from the lattice's design region. Promoting voice to charter status would force every recommendation to negotiate voice with structure, doubling the surface area without raising the citation-pull ceiling. Demoting voice to a per-adapter parameter keeps the charter clean and isolates voice in the only layer it actually controls (the prose layer between snippets).

### Why P7 and P8 are rejected, not deferred

P7 (continuous automated citation-probe loop) directly violates the v0.3.0 PRD non-goal "no scraping engines from the plugin" — adopting it would re-introduce the v0.2.0 Playwright-stub maintenance burden the v0.3.0 reorientation explicitly removes. P8 (editorial-trust mediator marketplace) requires a two-sided marketplace bootstrap (recruit + train + pay editors) that is incompatible with the solo-engineer scope and the multi-user-but-single-builder ownership model. Both are *rejected* (not just deferred) so the v0.3.0 design space is unambiguously closed; if a later version relaxes either non-goal, they will be re-evaluated under that version's PRD.

### Why this charter is genuinely different from v0.2.0

The v0.2.0 finalists ([`solution-finalists.md`](../triz/solution-finalists.md)) selected **F1 PR-as-product** (developer customers) and **F2 CMS-native publishing loop** (publisher customers). Both finalists were *workflow shapes* — they specified how the system applies fixes (PR vs CMS draft). They did *not* specify what the citation-lift mechanism actually is at the page level; they delegated that to the Phase 5a skill bundle (`aeo-audit`, `content-brief-from-gap`, `schema-generator`).

v0.3.0's charter is at a different level. It does not specify the workflow shape (the workflow is the state machine in `architecture.md`). It specifies the **page-level inventive principles** that produce citation-lift: density, anchors, lattice, intermediary, inversion. The v0.2.0 workflow is one *substrate's* application path (the `web` adapter's PR mode); v0.3.0's charter is the *substrate-uniform* mechanism the workflow carries. The two compose: the v0.2.0 PR workflow can carry the v0.3.0 charter for git-backed pages, and the v0.3.0 charter is also delivered through the new Substack and YouTube adapters where v0.2.0's PR workflow was inapplicable.

## Implementation contract for R3-R5

`mcp/src/tools/index.ts` will gain five new tools (R3) that consume the charter:

1. **`pull_recommend`** — input: `useCaseId`. Output: `Recommendation[]` keyed by charter principle. Each recommendation MUST cite at least one of `[atomic_snippet_density, semantic_anchor_stability, q_shaped_subhead_lattice, cross_engine_intermediary, inverted_retrieval_target]` in its `principle_ids` field. The negative-principle guard rejects link-building / sitemap-firehose / ping recommendations during post-validation.
2. **`pull_apply_artifact`** — input: `useCaseId`, `recommendationId`. Calls the substrate adapter; output is the substrate-specific artifact.
3. **`pull_analyze`** — input: `useCaseId`. Reads measurements + prior iterations from Supabase; emits an `analysis` row that cites at least one charter principle and one attractor-flow metric (FTLE on the use case's iteration trajectory).
4. **`read_use_case_state`** — read-only state machine view of a use case.
5. **`record_use_case_event`** — append a stage transition row.

`plugin/scripts/adapters/{web,substack,youtube}.ts` (R4) implement the `Adapter` interface from [`docs/v0.3.0/spec.md`](../v0.3.0/spec.md). Each adapter carries:

- `voiceProfile` constant (per-substrate prose-layer parameter — P6 consumed)
- `recommend(useCase): Recommendation[]` returning charter-principle-typed recommendations
- `applyArtifact(rec, useCase): Artifact` materialising the recommendation in substrate-native form

`plugin/commands/pull-{recommend,apply,measure,analyze,state}.md` (R5) wire the user-facing surface and call the MCP tools above.

## Out of scope (charter-level)

- Engine-side scraping or automated probes (P7 rejected).
- Editorial marketplace (P8 rejected).
- Cross-page or whole-site lattice strategies (deferred to v0.5+).
- Non-user-controlled substrates (e.g. mentions on third-party sites).
- New TRIZ principles not in [`v0.3.0-pull-finalists.md`](../triz/v0.3.0-pull-finalists.md) (the charter is closed for v0.3.0; new principles re-open in v0.4+).
