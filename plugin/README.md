# LLM SEO Lab — Cursor plugin

Closed-loop autonomous AEO/LLM-SEO citation engineering. Audits your site, drafts the fix as a PR, measures the lift after merge.

## Components

| Kind | What it ships |
| --- | --- |
| commands (7) | `/aeo:bootstrap`, `/aeo:audit`, `/aeo:fix`, `/aeo:track`, `/aeo:loop`, `/aeo:compete`, `/aeo:status` |
| agent (1) | `aeo-loop` — drives one full closed-loop iteration with a hard human-review checkpoint at PR open |
| hook (1) | `on-pr-merge` — schedules a post-merge measurement window |
| skills (6) | `aeo-audit`, `citation-oracle-loop`, `content-brief-from-gap`, `schema-generator`, `freshness-radar`, `competitive-citation-intel` (symlinked from monorepo `../skills/`) |
| MCP server | `llm-seo-lab-mcp` (stdio), 12 tools — see `mcp/` |

## Layout

```
plugin/
├── .cursor-plugin/plugin.json   # manifest
├── commands/                    # one .md per command
├── agents/aeo-loop.md
├── hooks/on-pr-merge.json
├── skills -> ../skills          # symlink to monorepo skills bundle
├── mcp.json                     # registers the llm-seo-lab MCP server
├── package.json
├── tsconfig.json
└── tests/manifest.test.ts       # validates manifest, commands, agent, hook, mcp wiring
```

## Run the validation suite

```bash
npm test --workspace=@llm-seo-lab/plugin
```

## Closed-loop flow (v0.1.0)

1. `/aeo:bootstrap` — detect repo type, write `.llm-seo-lab/config.yaml`.
2. `/aeo:audit` — Tier-1 GEO-paper-grounded gap audit.
3. `/aeo:fix` — drafts a small PR (max 3-5 gaps) for human review.
4. **Human merges the PR.** The `on-pr-merge` hook fires.
5. `/aeo:track --scope=pr:NN` — citation oracle (Claude CLI primary, Playwright fallback).
6. `/aeo:loop --continue=pr:NN` — compute Δ citation share with two-proportion z-test + Bonferroni + bootstrap CI; write `pr-NN.json` to `.llm-seo-lab/results/`.

## Hard rules

- One open PR per site at a time.
- Never bypass human review at the PR step.
- Claude Code CLI subscription only — no API keys.
- Tier-1 evidence by default (configurable via SiteConfig `evidence_policy`).
