# ARIZ-85C session — C1 *measure vs act*

**Phase:** 2 · **Date:** 2026-04-25 · **Selected contradiction:** **C1 — measure vs act** (IFR 4/4 in [`contradiction-cards.md`](contradiction-cards.md))

ARIZ-85C is the 9-part Algorithm of Inventive Problem Solving. It pushes a Technical Contradiction (TC) into a Physical Contradiction (PC) and resolves the PC via separation in space, time, condition, or system level. We apply it here to the contradiction that defines the entire `llm-seo-lab` product.

## Part 1 — Analysis of the problem

**Mini-problem statement.**
> AEO/LLM-SEO platforms accurately measure AI citation share for a brand, but the customer must take all corrective action manually. We want a system that **measures citation share AND ships the corrective action** simultaneously, **without** requiring a separate human workflow per gap.

**Conflict pair.**
- Tool A — *Measurement*: The audit identifies a citation gap (e.g. "your page is missing structured data Tier-1 evidence per the GEO paper, so Perplexity is citing a competitor instead").
- Tool B — *Action*: A human reads the gap, opens an editor, rewrites the copy, ships JSON-LD, requests indexing, waits, re-audits.

**Mini-problem framing (TRIZ form).**
> If the *system itself* drafts and ships the corrective artefact, then the customer doesn't have to (good — closes the productivity gap), **but** the customer loses editorial control and the risk of the system shipping bad content rises (bad — introduces a new contradiction: speed vs editorial trust).

## Part 2 — Analysis of the problem model

**Operating Zone (OZ).** The customer's own content surface — the page HTML, the JSON-LD blocks, the internal-link graph, the sitemap. This is where the conflict plays out.

**Operating Time (OT).** The audit→PR→merge→re-audit cycle: 24–72 hours per fix, repeated weekly per priority topic.

**Resources available** (be greedy here — ARIZ wants every resource enumerated):

| Resource | What it offers |
|---|---|
| Customer's git repository | Existing version control + review surface (PRs) |
| Customer's CI pipeline | Existing build/deploy infrastructure |
| Claude Code CLI subscription | Reasoning engine; flat-cost; subprocess-callable |
| Customer's browser sessions on AI engines | Ground-truth citation probe (per C4) |
| Existing CMS / static site generator | Renders the artefacts |
| GEO-paper evidence policy | The decision policy that picks which fix to draft first |
| Public RSS / partner feeds (OAI-SearchBot, IndexNow) | Per-engine push channels |
| The customer's domain authority | The "spine" that absorbs the action's effect |
| Pre-existing skill bundle (Phase 5a) | Concrete actuators (`aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`) |
| The customer's review attention | The human-in-the-loop guard against bad output |

**Key insight.** The system already has *every* resource it needs. The only thing it currently lacks is **the wiring** that turns each measurement into a draft action against an existing review surface.

## Part 3 — Definition of IFR and Physical Contradiction

**IFR-1 (functional ideality).**
> The X-resource, by itself, *eliminates the citation gap* during the operating time, in the operating zone, while preserving the customer's editorial control.

**X-resource candidate.** The customer's own git repository is the X-resource. It is the only resource that simultaneously:
1. **Receives** automated changes (via PRs)
2. **Gates** them through human review (no merge without approval)
3. **Triggers** the existing CI/CD that re-publishes the fix
4. **Hosts** the audit trail (every PR is the journal of what changed and why)

**Physical Contradiction (PC).**
> The system must **act** on the customer's content (to close the gap fast) AND must **not act** on the customer's content (to preserve editorial trust), simultaneously.

This is the canonical PC form: opposite values of the same property at the same time and place.

## Part 4 — Mobilization and use of substance-field resources

The PC is resolved by **separation in system level**: the *whole system* both acts and refrains from acting; *components* specialise so the contradiction is mooted.

**Component split.**
- **Audit component** — measures, never writes.
- **Drafter component** — writes drafts, never publishes (writes to a feature branch).
- **PR opener component** — opens a PR with diff, evidence, and revert instructions; never merges.
- **Customer reviewer (human, in-loop)** — merges or rejects; this is the *only* gate that authorises action.
- **Re-auditor component** — measures again after merge, attributes lift to PR, files a follow-up PR if needed.

The system, as a whole, *acts and does not act* simultaneously. The action exists (as a PR), but it is also not yet committed (until merged). The PC dissolves into a workflow that is already familiar to every engineering customer (it's just code review).

## Part 5 — Apply Inventive Standards / Principles

The Phase 2 matrix surfaced **Principles 28, 2, 10, 34** for `(28, 38)`. Each maps to a concrete component in the Phase 5 build plan:

| Principle | Concrete mapping |
|---|---|
| **#28 Mechanics Substitution** (replace mechanical with field) | Replace the mechanical handoff between "monitoring tool" and "writing tool" with a **field**: a structured PR describing the gap and the proposed fix as *one continuous artefact*. The PR is the field. |
| **#2 Taking Out** (extract the disturbing part) | Extract the human "translate gap to action" step — the disturbing element that all SOTA tools currently leave in. The remaining action (PR review) is what humans are already good at and should not be removed. |
| **#10 Preliminary Action** (perform required change before needed) | Pre-cache the GEO-paper evidence policy and the customer's prior PRs so the drafter has a per-customer voice/style profile *before* a new gap is detected. The first PR for each customer is bootstrapped from a 30-minute interview; subsequent PRs incorporate the merge/reject signal. |
| **#34 Discarding and Recovering** (let parts disappear after function) | Each PR is ephemeral after merge — its diff vanishes into git history; the audit-attribution result persists as a lightweight ledger entry. The "monitoring dashboard" itself is also ephemeral: its purpose is to vanish into PRs. |

Cross-checked principles from `(28, 39)` lookup:

| Principle | Concrete mapping |
|---|---|
| **#32 Color Changes** (visual encoding) | Dashboard view: each detected gap is a **status tile** that turns from red (gap detected) → yellow (PR open) → green (merged + lift attributed). The full state of the loop is visible at a glance. |

## Part 6 — Application of the Solution to the Original Problem

**Resolved problem statement.**
> The `llm-seo-lab` system, on a schedule, audits each priority page for citation gaps; for each gap, it drafts a fix as a feature-branch commit, opens a PR against the customer's repository with diff + evidence + GEO-paper policy citation + revert instructions; the customer reviews and merges; CI re-publishes; the system re-audits and attributes the lift to the PR. The customer never has to translate a measurement into an action — the action is already drafted before they see the dashboard.

**Worked example.** *Customer: technektar.dev* (per Phase-1 baseline-audit). The audit detects:
- Gap A: `robots.txt` declares `Sitemap: https://yourdomain.com/sitemap.xml` (placeholder shipped to production).
- Gap B: `sitemap.xml` lists `<loc>https://example.com/...` URLs.
- Gap C: No `Person` JSON-LD on the home page.

The system, in **one** PR (or three small PRs), ships:
- Branch `llm-seo/fix-sitemap-placeholders` updating both files to the real domain.
- Branch `llm-seo/add-person-jsonld-home` adding a `Person` block sourced from the GitHub bio.
- PR description includes Tier-1 evidence citations from `geo-evidence-base.md` for the JSON-LD addition.

The customer reviews and merges (or pushes back on copy). The system re-audits 7 days later and attributes the citation lift (or its absence) to the merged PRs.

This is what *no other SOTA tool currently ships*.

## Part 7 — Analysis of the Solution

**Does it eliminate the original contradiction?** Yes. The system measures (audit) AND acts (PR draft) simultaneously, but acting is gated by an artefact (the PR) that the customer already trusts.

**Does it introduce a new contradiction?** Possibly two:

1. **Quality drift** — bad PRs erode trust faster than good PRs build it. *Mitigation:* the drafter only proposes changes backed by Tier-1 GEO-paper evidence; never applies tactics shown to *hurt* citations (e.g. keyword stuffing); confidence-scores each PR and lets the customer set a confidence floor.
2. **PR fatigue** — too many PRs become noise. *Mitigation:* the PR opener bundles related fixes per page into one PR per page per cycle; respects a per-customer rate limit (default: 3 PRs/page/week).

**Both new contradictions are smaller than the original** and have explicit mitigations grounded in resources already available (confidence scoring, rate limiting).

## Part 8 — Application of the Solution

**Build plan tie-in.** Every component above maps cleanly to a Phase 5 worktree:

| ARIZ component | Phase 5 worktree | Concrete deliverable |
|---|---|---|
| Audit | 5a Skills | `aeo-audit` skill |
| Drafter | 5a Skills + 5d CLI worker | `content-brief-from-gap`, `schema-generator` skills + CLI worker subprocess to Claude Code CLI |
| PR opener | 5b MCP | `oracle_query` + new tool `open_fix_pr(repo, branch, diff, evidence_pack)` |
| Re-auditor | 5a Skills | `citation-oracle-loop` skill running on schedule |
| Dashboard tiles | 5e Next.js | App Router pages reading the `.llm-seo-lab/journal.jsonl` |

**Phase 6 evaluation tie-in.** The ARIZ resolution dictates the headline benchmark: **Δ citation share at 30 days, attributed per merged PR**, with a control arm that runs the audit but does *not* open PRs. This makes the loop's *closure* the unit of measurement, which is the true competitive question.

## Part 9 — Analysis of the Method

**What worked.**
- The TRIZ matrix surfaced four principles (28, 2, 10, 34) that *each* map to a concrete component, no slack.
- The PC ("act AND not-act") was resolved by separation in system level, which is also what every git-based engineering team already practises with code review — so the resolution is *not novel as a workflow* but is novel *applied to AEO citation engineering*. That is the right kind of novelty: the workflow is familiar, the application is new.
- The attractor-flow trajectory shows healthy CONVERGING → EXPLORING transition exactly where ARIZ predicts (the IFR formulation should expand the design space).

**What to watch.**
- The "human reviewer" component is the load-bearing assumption. If the customer doesn't review, the loop doesn't close. Phase 4 PRD must answer: what is the per-customer review SLA we promise to monitor and remind on?
- The "single PR per page per week" rate limit is a guess. Phase 6 power-analysis should set this from data.

---

## Phase 2 ralph-loop — ARIZ completion check

- [x] Mini-problem stated; conflict pair identified
- [x] Operating Zone, Operating Time, Resources enumerated (>10 resources)
- [x] IFR-1 stated with X-resource candidate identified (customer's git repo)
- [x] Physical Contradiction stated in canonical "must X AND must not X" form
- [x] Resolution via separation principle named (system-level separation)
- [x] All four matrix-recommended principles mapped to concrete components
- [x] Worked example on a real validation site (technektar.dev sitemap fix) provided
- [x] New-contradiction risks acknowledged with explicit mitigations
- [x] Phase 5 build mapping complete; Phase 6 evaluation hook defined
- [x] Method-level reflection captured

**Gate verdict:** pass. ARIZ deep dive complete. Proceeding to Phase 3 (TRIZ divergence → attractor convergence to 2 finalists).
