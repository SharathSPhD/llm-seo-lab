# llm-seo-lab — Cursor Plugin Architecture

**Date:** 2026-04-25 · **Phase:** 4 · **Status:** v0.1.0 plugin design freeze candidate · **Anchors:** [`2026-04-25-llm-seo-lab-design.md`](2026-04-25-llm-seo-lab-design.md), [`mcp-design.md`](mcp-design.md)

This document specifies the Cursor plugin component split — which capabilities live as **commands**, which as **agents**, which as **MCP tools**, which as **skills**, and which as **hooks**. It uses the `plugin-architect` skill's decision rubric and the `plugin-quality-gates` rule to constrain the manifest.

The principle: **every capability lives in exactly one component**, and the component is chosen by the rubric (not by familiarity).

---

## 1. Decision rubric (plugin-architect skill)

| Capability type | Best component | Why |
|---|---|---|
| User-initiated, single short-lived action | **command** (slash command) | Discoverable, triggered explicitly, reads/returns immediately |
| Multi-step orchestration with autonomy | **agent** | Drives a loop with judgment, may invoke commands and tools |
| Atomic data/IO operation invokable by any agent | **MCP tool** | Reusable across agents, languages; survives session resets |
| Long-form Claude reasoning behaviour with examples | **skill** | Embeds prompt + examples + decision logic the model loads at runtime |
| Reactive automation on Cursor events | **hook** | Fires on save/open/commit/etc.; no UI surface |
| Stateful background process | **MCP server (daemon)** | Long-running, accepts connections, holds state |

Applying the rubric to the v0.1.0 feature inventory (PRD §3):

| Feature | Component | Rationale |
|---|---|---|
| F.1.1–3 Site bootstrap | command `/aeo:bootstrap` | One-shot, user-initiated |
| F.2 Page audit | MCP tool `audit_page` + skill `aeo-audit` | Reusable atomic op + reasoning behaviour |
| F.3 Brief generation | MCP tool `generate_brief` + skill `content-brief-from-gap` | Same pattern |
| F.4 PR open | MCP tool `open_pr` (calls `gh CLI`) | Atomic IO op |
| F.5 Citation oracle | MCP tool `oracle_query` + skill `citation-oracle-loop` | Reusable; reasoning lives in skill |
| F.6 Post-merge measurement | MCP tool `track_citations` + hook `on-pr-merge` | Tool for data, hook for trigger |
| F.7 Freshness radar | skill `freshness-radar` + MCP tool `audit_page` | Reasoning + reuse |
| F.8 Competitive citation intel | skill `competitive-citation-intel` + MCP tool `compare_competitors` | Same |
| F.9 Plugin surface | commands + agent | This document |
| F.10 Web dashboard | (separate `apps/web/`, not a plugin component) | Out of plugin scope |
| F.11 CLI worker daemon | (separate `packages/cli-worker/`, exposed via MCP server) | Out of plugin scope but MCP-bridged |
| F.12 Configuration | MCP tool `read_config` + command `/aeo:configure` | Atomic ops + UI |

The closed-loop driver itself is the **`aeo-loop` agent**: it orchestrates audit → brief → PR open → wait-for-merge → re-audit by calling commands and MCP tools.

## 2. Plugin manifest layout

```
plugin/
├── plugin.json                    # manifest (per plugin-quality-gates rule)
├── commands/
│   ├── aeo-bootstrap.md
│   ├── aeo-audit.md
│   ├── aeo-track.md
│   ├── aeo-brief.md
│   ├── aeo-open-pr.md
│   ├── aeo-status.md
│   └── aeo-configure.md
├── agents/
│   └── aeo-loop.md                # the closed-loop driver
├── hooks/
│   └── on-pr-merge.json           # cron + git-hook wiring
├── skills/
│   ├── aeo-audit/SKILL.md
│   ├── citation-oracle-loop/SKILL.md
│   ├── content-brief-from-gap/SKILL.md
│   ├── schema-generator/SKILL.md
│   ├── freshness-radar/SKILL.md
│   └── competitive-citation-intel/SKILL.md
└── mcp.json                       # references mcp/ server registration
```

`plugin.json` (v0.1.0):

```json
{
  "$schema": "https://cursor.sh/plugins/schema.json",
  "name": "llm-seo-lab",
  "version": "0.1.0",
  "displayName": "LLM SEO Lab",
  "description": "Closed-loop autonomous AEO/LLM-SEO citation engineering. Audits your site, drafts the fix as a PR, measures the lift after merge.",
  "author": "SharathSPhD",
  "repository": "https://github.com/SharathSPhD/llm-seo-lab",
  "license": "MIT",
  "categories": ["seo", "content", "automation"],
  "keywords": ["aeo", "llm-seo", "geo", "citation", "claude-code"],
  "components": {
    "commands": "./commands",
    "agents": "./agents",
    "hooks": "./hooks",
    "skills": "./skills",
    "mcpServers": "./mcp.json"
  },
  "engines": {
    "cursor": ">=0.50.0"
  }
}
```

## 3. Commands (the user-facing slash surface)

Each command is a markdown file with frontmatter declaring inputs, outputs, and the underlying MCP tool / skill it delegates to.

### `/aeo:bootstrap`
- **Input:** none (uses current workspace).
- **Behaviour:** detects site type, generates `.llm-seo-lab/config.yaml`, opens bootstrap PR.
- **Delegates:** MCP tool `read_repo_metadata`, MCP tool `write_config`, MCP tool `open_pr`.

### `/aeo:audit [page-glob?]`
- **Input:** optional glob (e.g. `pages/blog/**/*.md`); defaults to all sitemap entries.
- **Behaviour:** runs `aeo-audit` skill per page; prints summary; writes `.llm-seo-lab/audits/<ts>/` artifacts.
- **Delegates:** MCP tool `audit_page` (per page) + skill `aeo-audit`.

### `/aeo:track [topic?]`
- **Input:** optional topic name; defaults to all configured topics.
- **Behaviour:** runs `citation-oracle-loop` skill against the question bank; produces citation-share snapshot.
- **Delegates:** MCP tool `oracle_query` + MCP tool `track_citations` + skill `citation-oracle-loop`.

### `/aeo:brief <gap-id>`
- **Input:** gap-id from a prior audit.
- **Behaviour:** runs `content-brief-from-gap` skill; emits brief + diff.
- **Delegates:** MCP tool `generate_brief` + skill `content-brief-from-gap`.

### `/aeo:open-pr <brief-id>`
- **Input:** brief-id from a prior brief.
- **Behaviour:** creates branch, commits diff, opens PR via `gh CLI`.
- **Delegates:** MCP tool `open_pr`.

### `/aeo:status [pr-number?]`
- **Input:** optional PR number; defaults to all open `aeo` PRs.
- **Behaviour:** prints PR status (open/merged/rejected), measurement schedule, current citation-share delta.
- **Delegates:** MCP tool `read_results` + MCP tool `read_pr_status`.

### `/aeo:configure`
- **Input:** none (interactive prompts).
- **Behaviour:** edits `.llm-seo-lab/config.yaml` (engines, cadence, evidence policy, thresholds).
- **Delegates:** MCP tool `read_config` + MCP tool `write_config`.

## 4. Agents

### `aeo-loop`
The closed-loop driver. Lives in `plugin/agents/aeo-loop.md` with frontmatter declaring tools (`audit_page`, `generate_brief`, `open_pr`, `oracle_query`, `track_citations`, `read_pr_status`, `read_results`).

System prompt structure (excerpt):

```
You are the closed-loop AEO citation engineering driver for llm-seo-lab.
Your job is to repeatedly: audit -> brief -> open PR -> wait for merge -> re-audit.

Principles:
1. The act of measurement IS the intervention. Every audit produces a brief; every brief produces a PR; every merged PR produces a re-audit.
2. Apply only Tier-1 GEO-paper tactics in the first iteration: Cite Sources, Quotation Addition, Statistics Addition. Tier-2 tactics (FAQ schema, internal-link injection) only after Tier-1 baseline established.
3. Respect the customer's review cadence. Never auto-merge. Never bypass the human-in-the-loop.
4. If a PR sits unmerged for 14 days, downgrade to advisory mode and surface the gap with a "why this matters" explanation.
5. If the customer's robots.txt blocks AI crawlers, PR #1 must be a robots.txt fix; surface this as the highest-priority advisory if the customer rejects the fix.

You receive: the customer's repo path and the .llm-seo-lab/config.yaml.
You produce: a sequence of opened PRs and a measurement timeline.

Start by calling read_config, then audit_page on each sitemap URL, then for each gap above threshold call generate_brief and open_pr.
After PR open, wait 24h before checking read_pr_status. After merge detected, schedule track_citations at T+1d, T+7d, T+14d.
```

The agent is invokable via `@aeo-loop` mention in chat or programmatically by the daemon.

## 5. Hooks

### `on-pr-merge`
- **Trigger:** git post-merge hook on `aeo/*` labeled PRs (or nightly cron in daemon as fallback for non-Git platforms).
- **Action:** schedules MCP tool `track_citations` runs at T+1d, T+7d, T+14d.
- **Implementation:** `hooks/on-pr-merge.json` declares the trigger; the action is delegated to the cli-worker daemon via WebSocket message.

### `on-config-change` (optional, v0.1.0)
- **Trigger:** file save on `.llm-seo-lab/config.yaml`.
- **Action:** validates the YAML and offers a `/aeo:audit` re-run if material changes detected.

## 6. Skills (Claude Code skill files)

Each skill is a SKILL.md with `name`, `description`, `tools` frontmatter. Skills are loaded by Claude Code at runtime; the descriptions matter because they drive tool-selection by the model. Descriptions follow the `create-skill` skill guidance: action-oriented, lists trigger phrases.

### `aeo-audit`
- **Description:** "Audit a web page for AEO/LLM-SEO citation-worthiness against the GEO-paper evidence policy (Cite Sources, Quotation Addition, Statistics Addition, Authoritative Tone). Use when the user asks to 'audit this page', 'check AEO score', 'find citation gaps', or invokes /aeo:audit."
- **Tools used:** `audit_page` (MCP).
- **Outputs:** structured gap report with predicted citation-share lift per fix.

### `citation-oracle-loop`
- **Description:** "Sample AI answer engines (Claude.ai, Perplexity, ChatGPT, Gemini, Google AIO) for a topic's question bank and record per-engine citation flags. Use when the user asks to 'check citations', 'sample engines', 'measure share of voice', or invokes /aeo:track."
- **Tools used:** `oracle_query`, `track_citations` (MCP).
- **Outputs:** per-engine citation share snapshot with provenance.

### `content-brief-from-gap`
- **Description:** "Translate an audit gap into a concrete page-edit brief with diff, GEO-paper rationale, and revert plan. Use when the user asks to 'fix this gap', 'draft a brief', or invokes /aeo:brief."
- **Tools used:** `generate_brief`, `emit_schema` (MCP).
- **Outputs:** markdown brief + unified diff + measurement plan JSON.

### `schema-generator`
- **Description:** "Generate JSON-LD blocks (Article / FAQPage / HowTo / Product / Organization) for a given page. Use when the user asks to 'add schema', 'generate JSON-LD', or as a sub-step of brief generation."
- **Tools used:** `emit_schema` (MCP).
- **Outputs:** ready-to-paste JSON-LD blocks with validation notes.

### `freshness-radar`
- **Description:** "Detect pages older than 3 months with declining citation share and propose refresh briefs. Use weekly or when the user asks 'what's getting stale'."
- **Tools used:** `audit_page`, `track_citations` (MCP).
- **Outputs:** prioritised refresh queue.

### `competitive-citation-intel`
- **Description:** "Identify URLs cited by AI engines for the customer's target topics that are NOT on the customer's domain, and surface gap-themes. Use monthly or when the user asks 'who's getting cited that we're not'."
- **Tools used:** `compare_competitors`, `oracle_query` (MCP).
- **Outputs:** competitor citation map + gap-theme list.

## 7. MCP server reference

The plugin's `mcp.json` references the MCP server defined in [`mcp-design.md`](mcp-design.md). The server runs as part of the cli-worker daemon (`packages/cli-worker/`) and exposes the 12 tools listed there.

## 8. Plugin quality gates checklist (per `plugin-quality-gates` rule)

- [x] Manifest validates against `https://cursor.sh/plugins/schema.json`.
- [x] All command files have frontmatter with `name`, `description`, `args` schema.
- [x] All skill files have frontmatter with `name`, `description` (action-oriented, ≤1 sentence).
- [x] All MCP tool descriptors include input/output JSON schemas (defined in mcp-design.md).
- [x] No secrets in manifest or skill files.
- [x] `engines.cursor` is set to a valid version range.
- [x] License is declared (MIT).
- [x] Repository field is set.
- [x] Component paths exist relative to plugin root.

## 9. Testing the plugin

- **Unit:** each skill has a 3-example fixture in `skills/<name>/tests/` validated by a small Python harness during CI.
- **Integration:** a `plugin/tests/integration/` Playwright run loads the plugin in a Cursor instance and exercises each command end-to-end against a fixture repo.
- **Manifest validation:** `plugin/tests/validate-manifest.ts` runs against the plugin-quality-gates rule.
- **MCP tool calls:** mocked in plugin unit tests; real-MCP exercised in integration tests.

## 10. Plugin sign-off checklist

- [x] Component split rationalised against decision rubric.
- [x] All v0.1.0 features mapped to a component.
- [x] Manifest layout specified.
- [x] Each command, agent, hook, skill specified with delegation chain.
- [x] MCP tool surface referenced (full spec in mcp-design.md).
- [x] Plugin quality gates checklist passed at design time.
- [x] Test pyramid sketched.
