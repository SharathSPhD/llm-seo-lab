# Pratyaksha integration — TRIZ contradiction cards

> Phase R3 of `aeo_review_remediation_v02`. Three contradictions framed against the
> AEO closed-loop, scored against the seven pratyaksha mechanisms surveyed in the
> [pratyaksha-context-eng-harness](https://github.com/SharathSPhD/pratyaksha-context-eng-harness)
> repo. Companion to `docs/triz/r3-pratyaksha-attractor.json` and the decision in
> `docs/decisions/2026-04-26-pratyaksha-integration.md`.

## Contradiction C1 — Speed vs precision (drafting)

| field | value |
| --- | --- |
| improving | Speed (TRIZ #9) — fast brief drafts (single Claude CLI call, low latency) |
| worsening | Measurement accuracy (TRIZ #28) — verified, multi-source citations |
| matrix principles | 28, 32, 1, 24 |

**Statement.** The AEO loop must produce fast brief drafts (low latency, single
`claude --print` call) AND verified citations (high precision, multi-source
provenance) at the same time.

**Pratyaksha candidates.**

| candidate | TRIZ score (0-4) | rationale |
| --- | --- | --- |
| Sākṣī (witness) | 2 | Pre-condition only; does not directly resolve speed/precision. |
| Manas / Buddhi pair | **4** | Manas drafts fast; Buddhi verifies precision; PR open is gated on Buddhi. The two roles dissolve the contradiction by separating concerns at the gate. Full IFR. |
| Sublation-with-evidence | 3 | Helps when verification finds a contradiction with prior recommendations; not the primary mechanism for first-pass precision. |
| Khyātivāda classifier | 2 | Adds a bespoke component; partial improvement. |

## Contradiction C2 — Mutability vs traceability (recommendations)

| field | value |
| --- | --- |
| improving | Adaptability / versatility (TRIZ #35) — update prior audit recommendations when site state changes |
| worsening | Loss of information (TRIZ #24) — preserve a complete audit trail of every recommendation change |
| matrix principles | (no direct cell — see C2′ below) |

**Statement.** The AEO loop must update prior audit recommendations AND preserve
a complete audit trail of why every recommendation changed.

The TRIZ matrix has no direct cell for `35 vs 24`, so we re-frame as the dual:

### C2′ — Same conflict, dual framing

| field | value |
| --- | --- |
| improving | Ease of operation (TRIZ #33) — simple to mutate / supersede a recommendation |
| worsening | Loss of information (TRIZ #24) — preserve full reason history |
| matrix principles | 4, 10, 27, 22 — including #22 *Blessing in Disguise* (turn the harm into the resource) |

**Pratyaksha candidates.**

| candidate | TRIZ score (0-4) | rationale |
| --- | --- | --- |
| Sublation-with-evidence | **4** | The supersession event IS the audit trail: every overwrite is a precision-weighted pointer + evidence_text + sublation_reason in the pratyaksha store. The loss-of-information harm becomes the audit-trail resource (Principle #22). Full IFR. |
| Avacchedaka qualified store | 3 | Provides the addressable, queryable substrate Sublation writes into; consumed transitively. |
| Sākṣī (witness) | 3 | Hard-pins the rule "never overwrite a prior recommendation — sublate it". Necessary enabler. |

## Contradiction C3 — Continuity vs accuracy (long sessions)

| field | value |
| --- | --- |
| improving | Loss of time (TRIZ #25) — the loop runs across many turns and many days |
| worsening | Measurement accuracy (TRIZ #28) — long context drifts and silently degrades audit quality |
| matrix principles | 24, 34, 28, 32 |

**Statement.** The AEO loop runs across many turns and many days; we must keep
the loop running over long timescales AND avoid context drift that silently
degrades audit and brief quality, AND respect a fixed token budget per session.

**Pratyaksha candidates.**

| candidate | TRIZ score (0-4) | rationale |
| --- | --- | --- |
| Boundary compaction | **4** | Compacts older non-witness context into summaries while preserving Sākṣī verbatim. Direct reuse of pratyaksha's `boundary_compact`. Acts at engine layer, not loop layer. Full IFR. |
| Sākṣī (witness) | 3 | Witness elements are immune to compaction by definition; without Sākṣī, boundary_compact has no anchor. |
| Budget gauge | 3 | Triggers compaction pre-emptively; subsumed by `boundary_compact`'s own budget tracking. Defer until evidence of pressure. |

## Aggregate ranking

| candidate | C1 | C2 | C3 | sum | verdict |
| --- | --- | --- | --- | --- | --- |
| Sākṣī | 2 | 3 | 3 | **8** | ADOPT (enabler — required by everything below) |
| Sublation-with-evidence | 3 | 4 | 1 | **8** | ADOPT (deepest basin on C2) |
| Manas / Buddhi | 4 | 2 | 2 | **8** | ADOPT (Full IFR on C1) |
| Boundary compaction | 1 | 1 | 4 | **6** | CONSUME via pratyaksha skill (no AEO-specific code) |
| Avacchedaka | 1 | 3 | 1 | **5** | CONSUME transitively (Sublation writes into it) |
| Budget gauge | 1 | 1 | 3 | **5** | DEFER (subsumed by boundary_compact) |
| Khyātivāda | 2 | 1 | 1 | **4** | DEFER (no infrastructure leverage) |

## Attractor-flow corroboration

Recorded by `scripts/attractor-trajectory-r3.py` →
`docs/triz/r3-pratyaksha-attractor.json`. Salient signals:

- **Sublation** lands in `OSCILLATING` regime with the lowest FTLE of the run
  (`-0.1031`) — deepest stable basin.
- **Manas/Buddhi** is `CONVERGING` (FTLE `-0.0669`) — second-deepest basin.
- **Khyātivāda** is `CYCLING` and **Avacchedaka / Boundary compaction** are
  `DIVERGING` as standalone AEO components (they belong below the loop, not in
  it).
- The verdict step triggers a `HOPF` bifurcation against the candidate trail,
  which we read as the trajectory locking onto the Sākṣī + Sublation +
  Manas/Buddhi attractor.

The TRIZ ranking and the attractor-flow basin depths agree.
