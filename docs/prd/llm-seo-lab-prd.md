# llm-seo-lab — Product Requirements Document (PRD)

**Date:** 2026-04-25 · **Phase:** 4 · **Status:** v0.1.0 PRD candidate · **Anchors:** [`2026-04-25-llm-seo-lab-design.md`](../spec/2026-04-25-llm-seo-lab-design.md), [`solution-finalists.md`](../triz/solution-finalists.md), [`competitor-matrix.md`](../research/competitor-matrix.md)

This PRD turns the design spec into a shippable product. It defines the user, the wedge, the v0.1.0 feature scope, the pricing tiers, and the success metrics — including the statistical bar for "we beat the dashboards" claims.

---

## 1. Target user (v0.1.0)

**Primary persona — "Indie technical builder."** A solo founder, indie dev, or small-team OSS / SaaS / docs maintainer who:
- Owns at least one content surface (a marketing site, a blog, a docs site, an OSS landing page).
- Has a GitHub repo for that surface (Astro / Next.js / Hugo / Jekyll / static HTML / docs frameworks).
- Already pays for Claude Code CLI ($20–$200/mo subscription).
- Cares about being cited by ChatGPT, Perplexity, Claude.ai, Gemini, Google AIO when prospects ask category-relevant questions.
- Cannot afford or doesn't want $99–$399/mo enterprise dashboards (AthenaHQ, Profound) and finds Otterly's $49/mo "monitoring only" insufficient.

**Concrete v0.1.0 dogfood users:** the project author (technektar.dev, SharathSPhD GitHub Pages, technektar.substack.com — Substack handled in v0.2.0). Plus 2 indie sites surfaced in Phase 7.

**Secondary persona — "AEO-curious developer team."** Small product team (≤5 devs) inside a series-A startup that wants the citation-engineering loop wired into their existing CI/PR workflow without bolting on a SaaS dashboard.

**Out of v0.1.0 (future):** non-developer publishers (Substack writers, Ghost editors), large enterprise marketing teams, agencies managing 10+ client sites.

## 2. The wedge — what makes us pathbreaking

| Dimension | Incumbents (AthenaHQ, Profound, Otterly, Peec, Goodie, Geol, Scrunch) | llm-seo-lab v0.1.0 |
|---|---|---|
| **Action surface** | Dashboard recommendation + manual implementation | Auto-drafted PR against customer's repo |
| **Loop closure** | Customer self-attributes lift after manual work | System re-audits + measures + attributes within 14 days |
| **Cost basis** | Per-token API cost (passed through in pricing) | Flat Claude Code CLI subscription (no per-token) |
| **Pricing floor** | $49/mo (Otterly monitoring) → $399/mo (Profound) | $19–$99/mo flat |
| **Trust artifact** | Black-box recommendation | PR diff + GEO-paper evidence rationale + revert plan |
| **Evidence basis** | Vendor-claimed metrics, often confounded | Tier-1 evidence-policy from KDD 2024 GEO paper |
| **Privacy model** | Customer content uploaded to vendor servers | Customer content stays in customer's machine + Claude CLI subscription account |
| **Statistical claim** | "X% lift" (often confounded) | Two-proportion z-test + Bonferroni + bootstrap 95% CI per merged PR |

The wedge is **closed-loop autonomous citation engineering** packaged at indie-builder pricing — a category that does not exist as of April 2026.

## 3. v0.1.0 feature inventory (numbered for traceability into the implementation plan)

### F.1 — Site bootstrap
- F.1.1 Detect site type from `gh repo view` (Astro/Next.js/Hugo/Jekyll/static).
- F.1.2 Generate `.llm-seo-lab/config.yaml` with engines, sampling cadence, eval policy.
- F.1.3 Open bootstrap PR (`aeo: bootstrap`) for customer review.

### F.2 — Page audit
- F.2.1 Enumerate pages via sitemap.xml or filesystem walk.
- F.2.2 Per-page extract: meta, JSON-LD, headings, internal links, canonicals, dates, schema types.
- F.2.3 Score each page against GEO-paper evidence policy via Claude CLI; emit gap report.
- F.2.4 Site-wide rollup with aggregate gap themes.

### F.3 — Brief generation
- F.3.1 For each gap above threshold: produce concrete diff (JSON-LD additions, meta updates, H-tag restructure, internal-link injection, sitemap entry edits).
- F.3.2 Emit matching JSON-LD blocks (Article / FAQPage / HowTo / Product).
- F.3.3 Attach GEO-paper evidence rationale and revert plan.

### F.4 — PR open
- F.4.1 Create branch `feature/aeo-NNN-<slug>`.
- F.4.2 Commit diff with structured commit message.
- F.4.3 Open PR via `gh CLI` with title, body, labels, measurement plan.

### F.5 — Citation oracle
- F.5.1 Per-engine sampling: Claude CLI primary, Playwright fallback, screenshot evidence layer.
- F.5.2 Question bank per topic (30–50 buyer questions).
- F.5.3 Per-engine, per-question citation flag with provenance (cited URL, snippet, timestamp).

### F.6 — Post-merge measurement
- F.6.1 CI hook detects merged `aeo` PRs (or nightly cron in daemon).
- F.6.2 Re-audit jobs at T+1d, T+7d, T+14d.
- F.6.3 Statistical analysis: two-proportion z-test, Bonferroni across engines, bootstrap 95% CI.
- F.6.4 Lift attribution to PR; flagged no-lift PRs trigger alternative tactic in next iteration.

### F.7 — Freshness radar
- F.7.1 Detect pages >3 months old with declining citation share.
- F.7.2 Queue refresh PRs (date update, statistic refresh, citation refresh).

### F.8 — Competitive citation intel
- F.8.1 Identify competitor URLs cited for the customer's target topics.
- F.8.2 Surface gap-themes (what competitors are cited for that the customer is not).
- F.8.3 Monthly cadence rollup.

### F.9 — Cursor plugin surface
- F.9.1 Slash commands: `/aeo:audit`, `/aeo:track`, `/aeo:brief`, `/aeo:open-pr`, `/aeo:status`.
- F.9.2 `aeo-loop` agent that drives the full closed-loop cycle from chat.
- F.9.3 Plugin manifest validates against `plugin-quality-gates` rule.

### F.10 — Web dashboard
- F.10.1 Per-site report: audit summary, gap themes, PR queue.
- F.10.2 Citation-share trend chart per engine.
- F.10.3 Statistical results panel per merged PR.
- F.10.4 Lineage view ("why was this PR opened?").

### F.11 — CLI worker daemon
- F.11.1 Subprocess Claude Code CLI with queue + rate-limit per subscription tier.
- F.11.2 WebSocket publisher for dashboard live updates.
- F.11.3 Per-substrate plugin loader (v0.1.0: `git-substrate.ts` only).

### F.12 — Configuration
- F.12.1 `.llm-seo-lab/config.yaml` schema with engines, cadence, evidence policy, thresholds.
- F.12.2 First-run wizard generates default config from repo introspection.

## 4. Pricing tiers

Pricing is anchored against the four most-comparable incumbents and the Claude Code CLI subscription cost basis the user already pays.

### 4.1 Anchor table

| Vendor | Floor | Ceiling | What you get |
|---|---|---|---|
| Otterly.AI | $49/mo | $149/mo | Monitoring only (no act) |
| Geol.ai | Free | $299/mo | Dashboard + manual recs |
| AthenaHQ | $99/mo | ≥$299/mo | Dashboard + 1000-question methodology |
| Profound | $99/mo | $399/mo | Dashboard + agentic optimisation (closed beta) |
| Goodie | "Action credits" | usage-based | Generative agents (early access) |
| Peec.ai | $79/mo | $250/mo | Pure measurement; ToS disclaims influence |

(Source: [`competitor-matrix.md`](../research/competitor-matrix.md), Phase 1 research.)

### 4.2 llm-seo-lab tiers (proposed for v0.1.0)

| Tier | Price | What's included | Target user |
|---|---|---|---|
| **Indie** | **$0** (BYO Claude CLI) | Skills + MCP + Cursor plugin; self-hosted dashboard; 1 site; community support | OSS contributors, hobbyists, dogfood users |
| **Builder** | **$19/mo** | Indie + hosted dashboard; up to 3 sites; PR-queue UI; basic stats panel; email support | Indie technical builders (primary persona) |
| **Studio** | **$49/mo** | Builder + up to 10 sites; competitive citation intel; freshness radar; statistical reports as PDF; Slack integration | Small product teams (secondary persona) |
| **Pro** | **$99/mo** | Studio + unlimited sites; priority queue on the daemon; per-site Playwright fallback worker pool; SLA on PR open ≤ 5 min | Power users, agencies (early adopters) |

**Pricing rationale.** The Claude Code CLI subscription ($20–$200/mo) is paid by the user, not us — that is the **single largest cost item** in the SOTA dashboards' pricing models, and it is **already a sunk cost** for our target persona. By moving the per-token cost out of our P&L and into the user's existing subscription, we can undercut the AthenaHQ floor by ~5× at the Builder tier and still maintain margin on hosting + dashboard alone. The Indie tier is intentionally $0: it is the open-source on-ramp that maximises adoption and provides the federated benchmark co-op (S7) data substrate for v0.5+.

### 4.3 What we explicitly do NOT charge for

- Per-page audit cost.
- Per-question oracle sampling cost.
- Per-PR generation cost.
- Number of engines monitored.
- Number of citation-share queries per month.

The whole pricing model is flat, by design — the **single Claude CLI subscription = single oracle = single bill** thesis is what enables the indie pricing floor.

### 4.4 Revenue projection sanity check (illustrative, not commitment)

Assuming a Phase-7 dogfood + Substack post drives 100 sign-ups in the first month with a 30% paid conversion:
- 70 Indie ($0) + 25 Builder ($19) + 4 Studio ($49) + 1 Pro ($99) = **~$770 MRR** entering month 2.
- Hosting cost (Vercel free tier + dashboard backend on Vercel Hobby) ≈ $20/mo. → Net contribution ~$750/mo by month 2 with no paid acquisition.

This is a sanity check, not a forecast. It exists to verify the pricing model is not unit-loss-making at small scale.

## 5. Success metrics (v0.1.0 launch criteria)

### 5.1 Product metrics
- **M.1 Time-to-first-PR.** From `aeo-loop` start to first PR opened ≤ 5 minutes for a 50-page site (95th percentile across 5 dogfood runs).
- **M.2 PR merge rate.** ≥ 60% of opened PRs merged within 14 days across the 5 validation sites (a healthy rate; compared with HubSpot's reported manual rec acceptance rate of ~40%).
- **M.3 No-PR-fail rate.** ≤ 5% of audit cycles fail to produce any PR (excludes "site already optimal" outcomes).

### 5.2 Statistical claim metrics (the headline)
- **M.4 Citation-share lift attribution.** ≥ 1 PR with statistically significant citation-share lift (p < 0.05 after Bonferroni across engines, ≥ 5pp effect size, bootstrap 95% CI excluding zero) on at least 1 engine across the 5 dogfood sites.
- **M.5 Cross-engine effect.** ≥ 1 PR with significant lift on ≥ 2 engines (proves the loop generalises).
- **M.6 Beat-the-dashboard.** Aggregate citation-share lift on dogfood sites > public-claimed lift of nearest comparable AthenaHQ / Profound case study (with explicit caveats about uncontrolled comparison).

### 5.3 Validation infrastructure metrics
- **M.7 Reproducibility.** Every result row in `docs/benchmarks/results.md` is reproducible from the raw `samples.jsonl` files under `.llm-seo-lab/citations/`.
- **M.8 Statistical methodology coverage.** Power analysis, MDE justification, randomisation, Bonferroni, bootstrap CIs, effect-size reporting all present in `docs/benchmarks/methodology.md`.

## 6. Risks (PRD-level)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Customers don't trust auto-drafted PRs.** | Medium | High (kills adoption) | Every PR carries GEO-paper evidence rationale + revert plan; advisory mode for skeptical customers; PR template includes "what would happen if you reject this" guidance |
| **Claude CLI quota exhaustion at Pro tier scales.** | Medium | Medium (degrades SLA) | Daemon priority queue; per-tier rate limits documented; surface queue depth in dashboard; v0.2.0 adds optional second oracle (local LLM fallback) |
| **Statistical underpower on small dogfood cohort.** | High | High (kills credibility claim) | Synthetic 1000-question benchmark in Phase 6 supplements the dogfood; per-PR within-site pre/post + bootstrap CIs are statistically honest at small N; explicit caveats in whitepaper |
| **AI engines change citation behaviour mid-experiment.** | Medium | High (confounds) | Methodology doc requires same-day pre/post measurements; Phase 7 reports include engine-version metadata where available; supplementary qualitative analysis when engine changes detected |
| **Customer's robots.txt / sitemap is broken (technektar.dev case).** | High (already observed) | Low | Bootstrap PR is always PR #1; broken-baseline sites get a "fix robots first" advisory before any other PR |
| **Substack-class sites can't host the daemon or expose logs.** | High | Low for v0.1.0 (out of scope) | F2 in v0.2.0 explicitly handles via Playwright sampling + CMS API |

## 7. Out of scope (v0.1.0)

- Multi-tenant SaaS (any tier above Pro).
- Mobile app.
- Browser extension (Chrome/Firefox).
- Auto-merge / auto-publish without human review.
- CMS connectors (Substack, Ghost, Webflow, WordPress) — F2, v0.2.0.
- Federated benchmark co-op — v0.5+.
- Editorial marketplace — never (per [`solution-finalists.md`](../triz/solution-finalists.md)).
- Multi-language / multi-region (English / global only in v0.1.0).
- Voice / podcast / video citation tracking.

## 8. v0.2.0 → v1.0 roadmap (forward-looking, not committed)

| Version | Scope | Anchor |
|---|---|---|
| **v0.2.0** | F2 Substack + Ghost adapters; Playwright sampling oracle pool; first paid acquisition channel | solution-finalists §6 |
| **v0.3.0** | S4 CD-swarm intervention class on top of F1; per-page A/B-test allocator | solution-finalists §3 |
| **v0.4.0** | Auto-merge for low-risk tactics (label-gated, customer-opt-in); confidence-thresholded autonomy | risk §6 |
| **v0.5.0** | S7 Federated benchmark co-op (opt-in anonymised priors); per-tactic predicted-lift ranking | solution-finalists §6 |
| **v1.0** | Multi-substrate plugin marketplace (3rd-party action substrates); enterprise tier; SOC 2 path | TBD |

## 9. PRD sign-off checklist

- [x] Target user defined with concrete dogfood examples.
- [x] Wedge articulated against named SOTA tools.
- [x] Feature inventory enumerated for plan traceability.
- [x] Pricing tiers anchored against incumbents.
- [x] Success metrics include statistical bar.
- [x] Risks itemised with mitigations.
- [x] Out-of-scope explicit.
- [x] Roadmap forward-looking but not over-committed.
- [x] Anchored to spec + finalists + Phase 1 research.
