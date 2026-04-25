# Decision: which pratyaksha mechanisms enter the AEO loop

- **Status:** accepted
- **Date:** 2026-04-26
- **Phase:** R3 of `aeo_review_remediation_v02`
- **Inputs:**
  - `docs/triz/pratyaksha-contradiction-cards.md` (TRIZ scoring)
  - `docs/triz/r3-pratyaksha-attractor.json` (attractor-flow trajectory)
  - `.triz/session.jsonl` (per-step audit log)
  - [pratyaksha-context-eng-harness](https://github.com/SharathSPhD/pratyaksha-context-eng-harness)

## Verdict

| candidate | verdict | implementation surface |
| --- | --- | --- |
| **Sākṣī** (witness invariant) | **ADOPT** | `plugin/hooks/aeo-sakshi.sh` on `SessionStart`; calls `pratyaksha.set_sakshi` with the AEO invariants. |
| **Sublation-with-evidence** | **ADOPT** | `packages/cli-worker/src/runners/loop.ts` — Buddhi calls `pratyaksha.detect_conflict` against the prior audit and `pratyaksha.sublate_with_evidence` on contradictions before opening the PR. |
| **Manas / Buddhi** pair | **ADOPT** | `packages/cli-worker/src/runners/loop.ts` — Manas drafts the brief via `claude --print` (one fast call); Buddhi verifies via pratyaksha tools; PR open is gated on Buddhi clearance. |
| Avacchedaka qualified store | **CONSUME transitively** | Sublation writes into pratyaksha's qualified store via `context_insert`; we do not re-implement an AEO-specific store. |
| Boundary compaction | **CONSUME transitively** | Pratyaksha's own `boundary_compact` runs at engine layer; AEO only emits a one-line nudge in the existing `Stop` hook. |
| Khyātivāda heuristic classifier | **DEFER** | No infrastructure leverage; revisit only if real-run data shows Buddhi alone can't catch the contradictions. |
| Budget gauge | **DEFER** | Subsumed by `boundary_compact`'s own budget tracking; revisit only if real-run data shows budget pressure that compaction misses. |

## Rationale

### Why these three are the attractor

The TRIZ scoring (8/12 each — see contradiction cards) and the attractor-flow
basin depths agree:

- **Sublation-with-evidence** lands at the deepest negative-FTLE basin
  (`-0.1031`, `OSCILLATING`) — it converts TRIZ Principle #22 *Blessing in
  Disguise* into running code: every overwrite of a recommendation IS the audit
  trail entry that supersedes it. The "loss of information" harm becomes the
  audit trail resource.
- **Manas/Buddhi** is the second-deepest basin (`-0.0669`, `CONVERGING`) and
  the only Full-IFR resolution of C1. The contradiction (fast brief AND
  verified citations) dissolves because Manas only owes speed and Buddhi only
  owes accuracy.
- **Sākṣī** has no FTLE in this run (only two measurements after it lands)
  but it's the structural enabler the other two ride on: Buddhi gates against
  Sākṣī invariants, and Sublation refuses to delete witness elements.

### Why Avacchedaka and Boundary compaction are consumed, not adopted

Both score well structurally but show up as `DIVERGING` in the attractor-flow
trajectory when treated as standalone AEO components. The reason is they are
engine-layer concerns the pratyaksha MCP already implements. Re-implementing
them in `packages/cli-worker` or `mcp/src/tools` would be parallel construction,
not integration.

The right shape: register the pratyaksha MCP as an upstream service and let the
AEO loop call its tools. We get Avacchedaka by writing into pratyaksha's
context store; we get boundary compaction by letting pratyaksha run it
internally.

### Why Khyātivāda and Budget gauge are deferred

- **Khyātivāda** as a deterministic AEO classifier scored 2 across the board
  ("partial IFR") and lands in `CYCLING` regime — it's a limit cycle, not a
  stable basin. It would add a real new component (classifier + thresholds)
  the loop has to maintain. We will revisit only if Buddhi alone can't catch
  the contradiction modes we see in real runs.
- **Budget gauge** is a `CONVERGING` basin (FTLE `-0.0603`) but pure
  duplication: `boundary_compact` already tracks its own budget. Defer until
  we observe real-run pressure that bypasses compaction.

## Implementation contract for R4

`packages/cli-worker/src/runners/loop.ts` will gain three integration points:

1. **Witness setup** at runner construction:

   ```ts
   await pratyaksha.set_sakshi({
     invariants: [
       "subscription-only Claude CLI; no API keys",
       "audit precedes brief; brief precedes PR",
       "no synthetic citations",
       "never overwrite a prior recommendation — sublate it",
     ],
   });
   ```

2. **Manas draft** — unchanged shape, single `claude --print` call.
3. **Buddhi gate** — between brief generation and PR open:

   ```ts
   const conflict = await pratyaksha.detect_conflict({
     new_claim: brief.summary,
     against_store_query: { tag: `site:${site_id}`, limit: 50 },
   });
   if (conflict.detected) {
     await pratyaksha.sublate_with_evidence({
       superseded_id: conflict.superseded_id,
       new_text: brief.summary,
       evidence_text: brief.evidence,
       sublation_reason: conflict.reason,
     });
   }
   if (conflict.blocks_pr) {
     return { skipped: true, reason: "buddhi gate" };
   }
   ```

   Plus the SessionStart hook in `plugin/hooks/aeo-sakshi.sh`.

That contract — and the test in `mcp/test/pratyaksha.integration.test.ts` —
is what R4 implements.

## Out of scope

- Re-implementing Avacchedaka, Boundary compaction, or Budget gauge inside the
  AEO repo.
- Adding a Khyātivāda classifier without real-run evidence that Buddhi misses.
- Wiring pratyaksha into the MCP tool registry as native AEO tools — we
  register pratyaksha as a sibling MCP server and consume it by name.
