# llm-seo-lab v0.3.0 — Product Requirements Document

**Date:** 2026-04-26 · **Phase:** v0.3.0 R1 · **Status:** PRD candidate (pre-implementation freeze) · **Anchors:** [`spec.md`](spec.md), [`architecture.md`](architecture.md), [`migration.md`](migration.md), [`../prd/llm-seo-lab-prd.md`](../prd/llm-seo-lab-prd.md) (v0.1/v0.2 PRD, frozen for reference)

This PRD reorients the product. v0.1.0 and v0.2.0 framed the loop as **"audit → PR → merge → re-measure against competitor gaps."** v0.3.0 reframes the loop as **"recommend → user applies → user republishes → user measures across engines and analytics → user reports → analyze → next recommendation."** The plugin no longer scrapes engines, no longer benchmarks against competitors, and no longer assumes the page lives in a git repo. It serves any substrate the user owns — including platforms where the user does not control the URL (Substack, YouTube).

The existing v0.2.0 `/aeo:*` competitor-gap loop stays in place as **one tactic among many** that the new recommender can choose. The product is now a multi-stage, time-spread, human-gated workflow surfaced through a Supabase-backed dashboard.

---

## 1. Problem (one paragraph)

When an AI engine answers a question, it cites the sources its retriever ranks highest for that intent. Wikipedia, Reddit, GitHub, news outlets, and a handful of high-authority publishers dominate those rankings by default. A page published on a low-authority surface — a personal blog, a Substack post, a YouTube video, a small product site — starts at a structural disadvantage. The opportunity v0.3.0 addresses is not "match a competitor's gap" (the v0.2.0 framing) but **make any page citable from any substrate by changing what the page is, not where it lives**. The mechanism is iterative: a recommendation is produced, the user applies it, the page is republished, the user observes citation behaviour across engines and analytics over a chosen window, the system analyses what moved and what didn't, and a fresh recommendation is produced. Measurement is no longer the system's job — the user already lives inside ChatGPT, Perplexity, Google AIO, Substack analytics, YouTube Studio, and GA. The system's job is the inventive layer (recommend, analyze) and the bookkeeping (state, time, attribution).

## 2. Goal (the IFR sentence for v0.3.0)

> A system that, when a user adds any owned content URL — git-backed page, Substack post, YouTube video, hosted CMS — produces substrate-aware recommendations that creatively pull AI-engine citations to that page, accepts the user's own observations from any engine and analytics platform as the source of truth for whether the recommendation worked, and uses the resulting time series to converge on better recommendations on the next iteration. Zero scraping, zero auto-publish, zero benchmark dependency. Every action is human-triggered. Every observation is human-supplied. The plugin and Claude CLI only run when the user clicks a button.

## 3. Non-goals (v0.3.0)

- Auto-scraping any AI engine to verify citations. The Playwright crawler stub from v0.2.0 (the unfilled half of `track_citations`) is **deprecated as a product feature** and removed from the user-facing flow. Code stays in the repo as archive.
- Auto-publishing to Substack, YouTube, or any CMS. Adapters generate paste-ready artifacts and copy-paste checklists; the user does the publish step.
- Re-running Phase 6 simulation benchmarks. The competitor-gap statistical comparison framing is replaced by **within-use-case A/B over time**.
- Cloud hosting of the dashboard. v0.3.0 ships **local-first** on `localhost:3030` against a Supabase project the user creates. Cloud hosting + multi-tenant deployment are v0.4.0.
- Managing the user's `claude` authentication. The plugin shells out to whatever `claude` is on PATH. Subscription, API key, or none — the dashboard does not care and does not surface auth state for Claude.
- A Cursor marketplace listing for v0.3.0. Still alpha; users install from a local path or a git tag.

## 4. Target user (v0.3.0)

**Primary persona — "Multi-substrate creator."** A solo author, indie dev, or small-team operator who:

- Owns at least two distinct content surfaces of different substrates (e.g. a personal site + a Substack + a YouTube channel).
- Has `claude` CLI working (subscription or API; the dashboard does not care which).
- Can run a local Next.js dev server and a local MCP HTTP server.
- Will create a Supabase project (free tier is sufficient).
- Is willing to spend ~10 minutes per use case per iteration: 5 minutes applying recommendations, ~5 minutes per measurement window pasting prompts into engines and copying responses back into the form.
- Is comfortable accepting that the system does not guarantee a lift; it converges, and convergence requires multiple iterations.

**Secondary persona — "Single-page focus user."** Someone with one specific URL they want to move up the AI-citation rankings (a launch post, a product page, a research note). v0.3.0 supports this via the same use-case workflow with one entry.

**Out of v0.3.0:** anyone who wants the system to publish on their behalf, anyone who wants automated citation tracking without manual observation, agencies managing 10+ third-party use cases (the dashboard is multi-user but not multi-tenant in the agency sense — there is no client-billing or seat surface).

## 5. v0.3.0 feature inventory

### F.1 — Use case CRUD with substrate auto-detection

- F.1.1 User signs in with Supabase magic-link at `/login`.
- F.1.2 `/use-cases/new` wizard: paste any URL. The wizard auto-detects substrate as `web`, `substack`, or `youtube` based on URL pattern; user can override.
- F.1.3 User supplies title, topic, target audience, optional notes. Use case lands in `DRAFT` stage.
- F.1.4 `/dashboard` lists all of the user's use cases with current stage chip and last-event timestamp.

### F.2 — Stage machine with human-triggered transitions

- F.2.1 Each use case has a current `stage` and a complete `use_case_events` history.
- F.2.2 Allowed stages: `DRAFT`, `RECOMMENDED`, `APPLIED`, `REPUBLISHED`, `MEASURING`, `MEASURED`, `ANALYZED`, `ABANDONED`.
- F.2.3 Allowed transitions are enforced server-side; UI exposes only the next legal action(s).
- F.2.4 Every transition is timestamped, signed by the user_id, and writes a row to `use_case_events`.
- F.2.5 No automatic transitions. The dashboard never advances state without an explicit user click.

### F.3 — Recommendation generation (`pull_recommend`)

- F.3.1 On the user clicking `Recommend`, the dashboard calls MCP `pull_recommend` which shells out to Claude CLI.
- F.3.2 Recommendations are substrate-aware: a `web` recommendation may include `add JSON-LD FAQPage`; a `substack` recommendation may include `restructure the lede into an answer-first paragraph`; a `youtube` recommendation may include `add timestamped chapter for the central question + paste a structured answer in the pinned comment`.
- F.3.3 Each recommendation carries a TRIZ-principle tag (from the v0.3.0 charter, see [`../triz/v0.3.0-pull-finalists.md`](../triz/v0.3.0-pull-finalists.md)) and an applicability score per substrate.
- F.3.4 Recommendations are persisted to Supabase `recommendations` and surfaced in the use-case stage panel.

### F.4 — Apply artifact (`pull_apply_artifact`)

- F.4.1 On the user clicking `Build apply artifact`, the dashboard calls MCP `pull_apply_artifact`.
- F.4.2 For `web` substrates with a detected git remote: generates a PR-ready diff (uses the same `open_pr` machinery as v0.2.0 if the user opts in).
- F.4.3 For `web` substrates without git access: generates paste-ready HTML/Markdown blocks the user copies into their CMS.
- F.4.4 For `substack`: generates paste-ready Markdown for the post body plus a strict diff-report listing what was changed.
- F.4.5 For `youtube`: generates a copy-paste checklist mapped to YouTube Studio fields (title, description, tags, chapters, pinned comment, end-card text). No video-content recommendations in v0.3.0 — the visible knobs only.
- F.4.6 The artifact is persisted to Supabase `applications` once the user confirms they have applied it.

### F.5 — User-reported measurement

- F.5.1 User clicks `Start measuring` on `REPUBLISHED` to enter `MEASURING`. UI exposes a `Submit observations` form.
- F.5.2 `/use-cases/[id]/measurements/new` accepts: engine (`chatgpt`, `perplexity`, `google_aio`, `claude_ai`, `gemini`, `other`), prompt text, observed answer text, citation_present (boolean), citation_position (integer or null), source_authority (free text), free-text notes, optional screenshot upload.
- F.5.3 The same form has an "Analytics" sub-tab where the user pastes engine-agnostic numbers from GA / Substack / YouTube Studio (page views, referrer breakdowns, watch time, etc.) for the measurement window.
- F.5.4 User submits `≥1` observation per measurement window; clicks `Mark measurement complete` to advance to `MEASURED`. There is no minimum observation count enforced in v0.3.0 — analysis quality scales with the user's input.

### F.6 — Analysis (`pull_analyze`)

- F.6.1 On the user clicking `Analyze`, the dashboard calls MCP `pull_analyze` with `use_case_id`.
- F.6.2 The analyzer loads the use case's full state (recommendations, applications, measurements, prior analyses) from Supabase.
- F.6.3 It computes within-use-case A/B deltas across iterations (`measurements at iteration N` vs `measurements at iteration N-1` on the same engines+prompts where possible) and runs the v0.3.0 attractor-flow trajectory metrics on the recommendation set.
- F.6.4 It writes an `analyses` row containing: a verdict (`improved`, `stable`, `regressed`, `inconclusive`), per-engine deltas, attractor-flow metrics (FTLE, basin, goal distance, perturbation Δ from the v0.3.0 charter), one or more TRIZ principles cited as the reason for the verdict, and a next-iteration suggestion.
- F.6.5 User clicks `Next iteration` to drop back to `RECOMMENDED` with the analysis as input to the next recommendation; or `Abandon` to terminate the use case.

### F.7 — Use-case-level history view

- F.7.1 `/use-cases/[id]` shows the full event timeline, recommendation set per iteration, application notes, measurements grouped by engine, and analysis verdicts.
- F.7.2 The user can re-open any prior recommendation, compare iterations side-by-side, and export the use case as a JSON bundle.

### F.8 — Plugin parity

- F.8.1 Each F.2-F.7 action is also a plugin command: `/pull:state`, `/pull:recommend`, `/pull:apply`, `/pull:measure`, `/pull:analyze`. Users who prefer the IDE can drive a use case from Cursor or Claude Code without opening the dashboard.
- F.8.2 The dashboard is the **canonical state surface**; the plugin reads-and-writes Supabase via the same MCP tools.
- F.8.3 The existing `/aeo:*` competitor-gap commands continue to work for use cases configured in `data/sites/`. Tactical recommendations from `pull_analyze` may invoke `/aeo:loop` on the user's request.

## 6. What we explicitly remove or deprecate

| Surface (v0.2.0) | v0.3.0 status | Reason |
|---|---|---|
| `track_citations` MCP tool | Deprecation envelope (`{ok:false, error:"deprecated_v0.3.0"}`) | Measurement leaves the plugin. |
| `read_citation_trend` MCP tool | Deprecation envelope | Same. |
| Playwright crawler stub at `mcp/src/clients/playwright.ts` | Frozen, not removed | Code stays as v0.2.0 archive. Not invoked by any v0.3.0 path. |
| Phase 6 simulation benchmark suite under `benchmarks/` | Archived (README pointer) | No new runs. v0.3.0's measurement substrate is user-reported. |
| Sites-centric routes in `apps/web/app/sites/*` | Kept mounted under `/sites/*` as a v0.2.0 archive tab | Backwards-compat for the existing dogfood site `sharathsphd-githubio`. |
| The auth shim in `apps/web/lib/auth.ts` | Replaced with real Supabase implementation; `AuthUser` interface kept | Existing widgets compile unchanged. |

## 7. Success criteria for v0.3.0 release

A v0.3.0 tag is cut only when **all** of the following hold:

1. The three seed use cases (`technektar.dev`, `technektar.substack` post, the `youtu.be/fM2hpqPx8zg` video) are visible in the dashboard for a real signed-in user.
2. Each seed use case has at least one `RECOMMENDED` event with a non-stub recommendation set.
3. At least one seed use case has reached `MEASURED` with ≥3 observations spanning ≥2 engines.
4. At least one seed use case has reached `ANALYZED` with a non-stub `analyses` row that cites at least one TRIZ principle and one attractor-flow metric.
5. `/aeo:loop` still runs end-to-end against `data/sites/sharathsphd-githubio` (regression).
6. All v0.2.0 tests still pass; new v0.3.0 tests pass for the 5 new MCP tools and the 3 substrate adapters.
7. Supabase schema applies cleanly to a fresh project with RLS verified by a deny-test.
8. README quickstart works on a clean clone end-to-end.
9. v0.3.0 companion section is added to [`../../project-overview.html`](../../project-overview.html) and its lazy-loaded panels resolve.

## 8. What v0.3.0 does NOT claim

Reproduced verbatim into [`../limitations.md`](../limitations.md) under a v0.3.0 section header during R7:

- **Recommendation quality is contingent on Claude CLI output.** The same `claude --print` JSON-contract brittleness from v0.2.0 applies. `pull_recommend` falls open to a deterministic stub on parse failure.
- **The system does not verify that the user actually applied a recommendation.** `APPLIED` is a self-attestation. Users who lie to themselves get unreliable analysis.
- **Measurements are user-supplied.** Selection bias is fully on the user. The system reports what the user reports.
- **Within-use-case A/B is not a controlled experiment.** Engines change indexes between iterations; user prompts may drift; the user may run different prompts at different windows. The analyzer surfaces deltas; it does not claim causal attribution.
- **Three substrates only.** Web, Substack, YouTube. Other CMSes (Ghost, WordPress, Webflow, Notion) and other video platforms are out of scope.
- **No multi-user collaboration.** A use case is owned by exactly one user. There are no shared use cases, no team views, no audit trails of cross-user edits.
