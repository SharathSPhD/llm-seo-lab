# Adversarial Architecture Review — llm-seo-lab v0.1.0

**Date:** 2026-04-25  
**Review mode:** adversarial architecture / product-readiness audit  
**Scope:** entire `SharathSPhD/llm-seo-lab` repository against the original request for a TRIZ-driven, attractor-flow-converged, statistically validated AEO/LLM-SEO product made of Cursor plugin + MCP + skills + CLI worker + Next.js dashboard.  
**Verdict:** substantial research and implementation exist, but `v0.1.0` is not yet a fully integrated, empirically proven product. It is best described as a serious research-backed alpha with working subcomponents, passing tests, and a protocol for real-world proof.

---

## Executive Verdict

The project did produce a broad monorepo with research, TRIZ documentation, an MCP package, Cursor plugin metadata, skills, a CLI worker, a Next.js dashboard, a benchmark harness, per-site use-case protocols, and a whitepaper. This satisfies much of the requested artifact surface.

The strongest gap is that several claims are currently stronger than the evidence:

- **Phase 6 validates the benchmark harness under simulation, not live AEO lift.**
- **Phase 7 is a pre-registered real-site protocol, not completed real-site proof.**
- **The web dashboard, MCP server, and CLI worker do not yet share one compatible tool contract.**
- **The plugin is structurally valid, but not proven as a loaded Cursor plugin in a real end-to-end run.**
- **TRIZ and attractor-flow were genuinely used as written artifacts and Python-library runs, but the repo lacks the raw MCP session ledger and evaluator artifacts that would make the process fully auditable.**

The project is directionally aligned with the original ambition, but the current release should avoid language like "proven pathbreaking product" until the integration and live proof gaps are closed.

---

## Evidence Gathered During This Review

Commands run from the repository root:

| Check | Result |
|---|---|
| `git status --short --branch` | `main...origin/main`; dirty only because of untracked `uv.lock` and this review doc after writing. |
| `git tag -l` | `v0.1.0` exists locally. |
| `claude --version` | `2.1.119 (Claude Code)`. |
| `claude --print "Reply exactly: OK"` | Returned `OK`; Claude Code CLI is installed and callable. |
| `npm run test` | Passed: web 13, cli-worker 39, shared 10, plugin 18, MCP 34 tests. |
| `npm run typecheck` | Passed all TypeScript workspaces. |
| `npm run build` | Passed; Next.js production build completed. |
| `npm run smoke` | Passed; cli-worker `/health`, WebSocket handshake, and SIGTERM drain verified. |
| `python3 -m unittest discover -s benchmarks -p '*_test.py'` | Passed 37 benchmark tests. |
| MCP HTTP smoke via `startServer({ httpPort: 0 })` | Passed `ping`; `tools/list` returned 12 tools. |
| MCP `oracle_query` through HTTP | Passed and returned `sampling_path: "claude_cli"`, proving at least one MCP tool can invoke Claude CLI. |

Important limitation: this review did **not** prove the full browser/UI/product loop. The successful Claude CLI check proves the CLI exists and one MCP oracle path can call it. It does not prove the dashboard, Cursor plugin, PR creation, Playwright fallback, and T+14 measurement all work together.

---

## What Is Completed

### Research Expansion

Completed artifacts:

- `docs/research/seo_research_2.md`
- `docs/research/competitor-matrix.md`
- `docs/research/citation-mechanisms.md`
- `docs/research/geo-evidence-base.md`
- `docs/research/baseline-audit.md`

Assessment: strong. The project does expand the AEO/LLM-SEO research material and identifies a credible market contradiction: incumbent tools skew toward monitoring while the user still carries the implementation burden.

Remaining caveat: some claims are summaries of gathered evidence rather than fresh externally reproducible crawl data. That is acceptable if labelled as synthesis.

### TRIZ / ARIZ Artifacts

Completed artifacts:

- `docs/triz/contradiction-cards.md`
- `docs/triz/ariz-session.md`
- `docs/triz/solution-finalists.md`
- `docs/triz/attractor-trajectory.json`
- `docs/triz/attractor-convergence.json`
- `scripts/attractor-trajectory.py`
- `scripts/attractor-convergence.py`

Assessment: the contradiction-to-solution narrative is coherent. C1, "measure vs act," is a strong root contradiction for this category. The ARIZ move of treating the pull request as both "change" and "not-yet-change" is genuinely inventive and product-relevant.

But the TRIZ process is not fully reproducible from committed artifacts. `docs/triz/contradiction-cards.md` claims a `.triz/session.jsonl` ledger, but no `.triz/` tree or exported session log is committed. The evaluator-agent scores in `docs/triz/solution-finalists.md` are not backed by raw score payloads or a per-dimension rubric artifact.

### Spec, PRD, Plan

Completed artifacts:

- `docs/spec/2026-04-25-llm-seo-lab-design.md`
- `docs/prd/llm-seo-lab-prd.md`
- `docs/spec/plugin-architecture.md`
- `docs/spec/mcp-design.md`
- `docs/plans/llm-seo-lab-implementation-plan.md`

Assessment: the requested spec/PRD/plan-before-code artifact set exists and covers product, pricing, plugin architecture, MCP design, and implementation sequencing.

Main gap: the implementation plan and later code have drifted. The plan references paths and tests that do not all exist, and the README/install docs still describe the MCP package as Python/FastMCP while the implementation is TypeScript/Node.

### Product Components

Completed code surfaces:

- `skills/` — six skill bundles.
- `mcp/` — TypeScript server with 12 registered tools and tests.
- `plugin/` — Cursor plugin manifest, seven markdown commands, one agent markdown file, one hook config, and plugin manifest tests.
- `packages/cli-worker/` — daemon, queue, runner, rate limiting, WebSocket, health server, shutdown logic, and tests.
- `apps/web/` — Next.js dashboard pages, widgets, MCP client abstraction, and tests.

Assessment: these are real files with real tests. The repository is not just documentation.

Main gap: the product loop is not contract-aligned end to end. The web dashboard calls tool names and arguments that the MCP server does not register. The CLI worker loop sends argument shapes that do not match the MCP tool schemas. The MCP result envelope is `{ ok, value }`, but consumers often treat the returned result as the business DTO.

### Benchmarking

Completed artifacts:

- `docs/benchmarks/methodology.md`
- `benchmarks/`
- `benchmarks/runs/phase6-sim/results.md`
- `benchmarks/runs/phase6-sim/summary.json`

Assessment: this is one of the strongest parts of the repo. The statistical harness includes power analysis, two-proportion z-tests, Bonferroni correction, Cohen's h, bootstrap CIs, McNemar robustness, and reproducible simulation data.

Main gap: the benchmark is explicitly simulation-backed. It validates the pipeline and estimators, not a live-engine claim that ChatGPT/Perplexity/Gemini will cite the target sites more often.

### Phase 7 Use-Case Proof

Completed artifacts:

- `docs/use-cases/_protocol.md`
- `docs/use-cases/P1-technektar-dev-report.md`
- `docs/use-cases/P2-technektar-substack-report.md`
- `docs/use-cases/P3-sharathsphd-githubio-report.md`
- `docs/use-cases/P4-context-engineering-harness-report.md`
- `docs/use-cases/P5-attractor-flow-plugin-bench-report.md`
- `docs/whitepaper/llm-seo-lab-whitepaper.md`

Assessment: the protocol and per-site plans are detailed and research-grade.

Main gap: every site report still has pending T0/T+14 capture and result sections. Phase 7 is therefore **not real-world proof yet**. It is a pre-registered measurement plan plus intervention specification.

---

## Critical Findings

### 1. The Web Dashboard Does Not Match the MCP Tool Surface

Severity: critical.

Evidence:

- `apps/web/lib/actions/sites.ts` calls `list_sites`, but `mcp/src/tools/index.ts` registers no `list_sites`.
- `apps/web/lib/actions/audits.ts` calls `read_latest_audit`, but no such MCP tool is registered.
- `apps/web/lib/actions/prs.ts` calls `list_prs`, but no such MCP tool is registered.
- `apps/web/lib/actions/citations.ts` calls `read_citation_trend`, but no such MCP tool is registered.
- `apps/web/lib/actions/sites.ts` calls `read_config` with `{ site_id }`, but MCP `read_config` expects `{ config_path }`.

Impact: the Next.js app builds and unit tests pass because tests mock the MCP client, but the dashboard cannot reliably talk to the actual MCP server using default code paths. This is the biggest "app working?" gap.

### 2. Default HTTP Paths and Ports Are Inconsistent

Severity: critical.

Evidence:

- `apps/web/lib/mcp-client.ts` defaults to `http://localhost:7374/mcp`.
- `mcp/src/transports/http.ts` only accepts `POST /rpc`.
- `packages/cli-worker/src/mcp_client.ts` defaults to `http://127.0.0.1:7301/rpc`.
- README/install instructions refer to daemon health on a separate port and do not cleanly define one MCP HTTP endpoint.

Impact: even if all components are started, the web app is pointed at the wrong default endpoint for the actual MCP server.

### 3. CLI Worker Loop Does Not Match MCP Tool Schemas

Severity: critical.

Evidence:

- `packages/cli-worker/src/runners/loop.ts` calls `read_config` with `{ repo_path }`; MCP expects `{ config_path }`.
- It calls `audit_page` with `{ site_id, pages }`; MCP expects `{ page_url, page_html?, skill_path? }`.
- It calls `generate_brief` with `{ site_id, gap_id, tactic, geo_paper_reference }`; MCP expects `{ gap, page_url, page_html, repo_path }`.
- It calls `emit_schema` with `{ site_id, gap_id, facts }`; MCP expects `{ page_type, page_url, page_title, facts }`.
- It calls `open_pr` with `{ site_id, branch_name, patch_unified_diff, labels, pre_audit_id }`; MCP expects `{ repo_path, branch, brief_id, pr_title, pr_body }`.

Impact: the loop tests pass against fake MCP clients, but the actual loop is not wired to the real MCP tool contract.

### 4. MCP Result Envelope Is Not Unwrapped by Consumers

Severity: high.

Evidence:

- `mcp/src/transports/jsonrpc.ts` returns successful tool calls as `result: { ok: true, value: ... }`.
- `packages/cli-worker/src/mcp_client.ts` returns `json.result` directly.
- `apps/web/lib/mcp-client.ts` also returns `json.result` directly.

Impact: consumers expecting the business object receive the wrapper instead. Tests miss this because many use mocks that return the business object directly.

### 5. MCP Widgets Are Not Registered as MCP App Resources

Severity: high.

Evidence:

- `mcp/src/widgets/` contains static HTML files.
- There is no server-side resource registration path for those widgets.
- The custom JSON-RPC transport implements `tools/list`, `tools/call`, and `ping`, but not MCP resource listing/reading or apps SDK metadata.

Impact: the claim "3 MCP widgets" is currently more of a scaffold than a working MCP App surface. The Next.js dashboard widgets are separate React components, not MCP app widgets.

### 6. Cursor Plugin Is Structurally Valid but Not Proven Loaded

Severity: high.

Evidence:

- `plugin/.cursor-plugin/plugin.json` exists and tests validate component paths.
- `plugin/tests/manifest.test.ts` passes.
- Commands are markdown files, not executable integration tests.
- No CI or checked-in transcript proves Cursor loaded the plugin, invoked a command, started the MCP server, and completed a loop.

Impact: the plugin is plausible and structured, but "plugin working" is not yet proven beyond manifest-level validation.

### 7. Claude Code CLI Integration Exists, but the Full Product Has Not Been Run Through It

Severity: high.

Evidence:

- `mcp/src/workers/claude.ts` spawns `claude --print`.
- This review confirmed `claude --version` returns `2.1.119 (Claude Code)`.
- This review confirmed `claude --print "Reply exactly: OK"` returns `OK`.
- This review confirmed MCP `oracle_query` can return `sampling_path: "claude_cli"` through HTTP.

Impact: the Claude CLI path is real. However, this is not the same as proving `audit → brief → PR → measure` works end-to-end through Claude CLI. Most tests mock Claude output. The full app/plugin workflow has not been proven with live Claude CLI in CI or a checked-in run log.

### 8. Phase 7 Is Protocol, Not Proof

Severity: high.

Evidence:

- Per-site reports have pending capture logs and result sections.
- `docs/use-cases/_protocol.md` defines T0/T+14 and says captures are to be committed later.
- No `benchmarks/runs/p7-*` T0/T+14 result files were found during review.

Impact: the repo should not say that real-site proof is complete. It can say the real-site protocol and intervention reports are complete.

### 9. Attractor-Flow Was Used, But Not Exactly as Advertised

Severity: medium-high.

Evidence:

- `scripts/attractor-trajectory.py` and `scripts/attractor-convergence.py` use the vendored `tools/attractor-flow` Python library.
- `docs/triz/attractor-trajectory.json` and `docs/triz/attractor-convergence.json` are reproducible artifacts from those scripts.
- The docs mention MCP-style `attractorflow_*` tool usage, but the committed runs are library calls, not saved MCP tool transcripts.

Impact: attractor-flow usage is real, but the claim should be precise: "used the attractor-flow Python implementation" rather than "all convergence claims came from MCP tool calls."

### 10. TRIZ Session Ledger Is Claimed but Missing

Severity: medium-high.

Evidence:

- `docs/triz/contradiction-cards.md` says `.triz/session.jsonl` was persisted.
- No `.triz/session.jsonl` is present in the repository.

Impact: TRIZ process traceability is incomplete. The docs are strong, but the MCP/tool evidence trail is not published.

### 11. A False Monotonicity Claim Exists in the TRIZ Narrative

Severity: medium.

Evidence:

- `docs/triz/contradiction-cards.md` says goal-distance "shrinks monotonically from 1.297 → 1.005."
- `docs/triz/attractor-trajectory.json` shows `1.0858 → 1.2971 → 1.317 → 1.3191 → 1.2676 → 1.2185 → 1.1349 → 1.0051`.

Impact: the final trend improves, but the sequence is not monotonic. The wording should be corrected before publication.

### 12. Documentation Drift Creates Credibility Risk

Severity: medium.

Examples:

- `README.md` says `mcp/` is "Python/FastMCP"; actual `mcp/package.json` is TypeScript/Node.
- `scripts/install.sh` tries to install a Python MCP server under `mcp/`, but `mcp/` has no `pyproject.toml`.
- Root `package.json` is version `0.0.1`, while packages/plugin use `0.1.0-alpha.1`, and the git tag is `v0.1.0`.
- `CHANGELOG.md` mentions tool names such as `list_sites`, `get_site_audit`, `get_pr_queue`, and `get_citation_trend` that do not exist in `mcp/src/tools/index.ts`.

Impact: readers will correctly suspect the release if install docs and implementation disagree.

---

## What Is Pending

1. **Real Phase 7 measurements:** T0/T+14 captures for all five sites, committed under `benchmarks/runs/p7-*`, rendered into per-site results.
2. **Dashboard-to-MCP integration:** make web actions call real registered MCP tools or add the missing tools.
3. **CLI worker-to-MCP integration:** align `runLoopOnce` arguments and result unwrapping with actual MCP schemas.
4. **Full live E2E:** one automated or manual logged run of `audit → generate_brief → open_pr → schedule measurement → read_results`.
5. **Cursor plugin runtime proof:** load plugin in Cursor, invoke command, start MCP server, and capture a transcript or screenshot/log.
6. **Playwright public-surface sampling:** replace or configure the default dead-session stub for production use; document auth/session requirements.
7. **MCP Apps widgets:** either register real MCP UI resources with app metadata or relabel the current HTML/React widgets as dashboard widgets only.
8. **TRIZ/evaluator audit trail:** commit a sanitized `.triz/session.jsonl` or equivalent exported evidence, plus evaluator score breakdowns.
9. **Documentation cleanup:** README, install script, changelog, versioning, and whitepaper claims need to be synchronized with actual code.
10. **Release relabeling:** decide whether `v0.1.0` means alpha/protocol release or product release. Current evidence supports "alpha/protocol release."

---

## What Is Off-Objective

These items drift away from the original ask or dilute credibility:

- **Simulation results presented too close to product proof.** The original ask required statistical rigor against SOTA and real use cases. Phase 6 has statistical rigor, but it is simulated. Phase 7 has real sites, but no results yet.
- **MCP app/widget language without MCP app implementation.** The build-mcp-app expectation implies resource-backed interactive widgets; the repo has static HTML files and Next.js widgets, but no MCP apps resource surface.
- **Install script Python MCP path.** The implementation became TypeScript/Node; the installer still talks like the MCP is Python.
- **Claiming ralph-loop gates as if enforceable.** Ralph-loop is reflected in checklists and process notes, not CI or committed loop artifacts.
- **Calling the current system a working closed loop.** The conceptual loop is strong, but the code contracts do not yet support an out-of-the-box loop.

---

## Is the Plugin/App Working?

Short answer: **parts work; the integrated product is not yet proven working.**

Working and verified:

- TypeScript workspaces pass tests.
- Typecheck passes.
- Next.js app builds.
- cli-worker smoke passes for health, WebSocket, and shutdown.
- MCP HTTP server starts, responds to `ping`, and lists 12 tools.
- MCP `oracle_query` can invoke Claude CLI and return a result with `sampling_path: "claude_cli"`.
- Cursor plugin manifest and component paths pass static tests.

Not proven or currently broken by contract mismatch:

- Next.js dashboard calling real MCP server with defaults.
- CLI worker loop calling real MCP server.
- Cursor plugin loaded and invoking commands in Cursor.
- MCP app widgets rendered by a host.
- Playwright fallback against real public AI surfaces.
- PR creation against a target repo in the full loop.
- T+14 measurement and result rendering for real sites.

Therefore the honest claim is:

> `llm-seo-lab` has working subcomponents and a tested Claude CLI path, but the full plugin/app closed loop has not yet been demonstrated end to end.

---

## Was TRIZ Properly Used?

Answer: **mostly as a structured design method, but not as a fully auditable tool run.**

Strengths:

- The problem framing is TRIZ-compatible.
- The C1 contradiction is credible and central.
- ARIZ is used in a meaningful way to derive the PR-as-product architecture.
- Phase 3 finalist selection uses TRIZ, evaluator scores, and attractor metrics as three intended lenses.

Weaknesses:

- Raw TRIZ MCP logs are missing.
- `.triz/session.jsonl` is claimed but absent.
- Evaluator scores are not reproducible from committed artifacts.
- Some parameter mappings need stronger defense.
- One attractor-flow monotonicity claim is factually wrong.

Required correction:

> Recast the TRIZ section as "documented TRIZ analysis supported by selected tool calls and attractor-flow scripts" unless the raw tool/evaluator logs are committed.

---

## Was Attractor-Flow Properly Used?

Answer: **yes as a design-space heuristic; no if claimed as full MCP/runtime validation.**

Strengths:

- The vendored attractor-flow implementation exists.
- Scripts import and run its Python components.
- JSON output is committed for trajectory and convergence.
- The S1 vs S5 robustness narrative matches the committed convergence JSON.

Weaknesses:

- The recorded runs are Python-library calls, not MCP tool transcripts.
- Basin depth in `scripts/attractor-convergence.py` includes local heuristic scoring.
- The analysis is over authored design text, not production runtime state.

Required correction:

> Describe attractor-flow as an embedding-based design convergence aid, not as empirical dynamical validation of the deployed product.

---

## Remediation Plan Before a Credible v0.1.1

### P0 — Fix Product Contracts

1. Choose one MCP HTTP endpoint, probably `http://127.0.0.1:7301/rpc`.
2. Update `apps/web/lib/mcp-client.ts`, README, install script, and env docs to match.
3. Decide whether web needs high-level tools (`list_sites`, `read_latest_audit`, `list_prs`, `read_citation_trend`) or should compose existing tools.
4. Align `packages/cli-worker/src/runners/loop.ts` with real MCP schemas.
5. Unwrap `{ ok, value }` or change the transport envelope so consumers receive the expected DTO.
6. Add one integration test that starts MCP HTTP and calls the same web action path that `/sites` uses.

### P1 — Prove the Closed Loop

1. Run one target repo through `audit_page`.
2. Generate at least one brief through Claude CLI.
3. Open a test PR or dry-run PR object.
4. Schedule a measurement via the hook.
5. Save the run log under `docs/reviews/evidence/` or `benchmarks/runs/e2e-*`.

### P2 — Fix Documentation and Release Identity

1. Replace "Python/FastMCP" MCP language with TypeScript/Node.
2. Fix `scripts/install.sh` Python MCP steps.
3. Align root/package/plugin versions.
4. Remove nonexistent tool names from changelog or implement them.
5. Relabel Phase 7 as "protocol complete, measurement pending."

### P3 — Make TRIZ/Attractor Evidence Auditable

1. Add a sanitized TRIZ MCP session export.
2. Add evaluator-agent score breakdowns with four 25-point dimensions.
3. Correct the non-monotonic goal-distance claim.
4. Add a one-paragraph defense for key TRIZ parameter mappings.
5. Clearly distinguish attractor-flow Python API runs from MCP tool runs.

### P4 — Complete Real-Site Proof

1. Commit T0 question banks and captures for all five sites.
2. Apply interventions.
3. Re-measure at T+14.
4. Render per-site result tables with z-test, Cohen's h, bootstrap CI, and McNemar robustness.
5. Update the whitepaper only after those results exist.

---

## Final Assessment

The project is not a toy. It contains serious research, a plausible novel wedge, a meaningful TRIZ-derived design, a large amount of real TypeScript/Python code, statistical machinery, passing tests, and a live Claude CLI integration path.

It is also not yet the fully working, empirically proven system implied by the most ambitious wording. The highest-risk gaps are integration contract drift, protocol-only real-site proof, missing TRIZ/evaluator audit trails, and docs that overstate or misdescribe implementation details.

Recommended public positioning:

> `llm-seo-lab v0.1.0` is a research-backed alpha and preregistered proof framework for closed-loop autonomous citation engineering. The core components compile and test, the Claude CLI path is callable, and the benchmark harness is reproducible under simulation. The next release must prove the integrated product loop and fill Phase 7 live results before claiming real-world AEO lift.
