---
name: pull:measure
description: Surface the measurement-entry context for a use case. The plugin does NOT auto-measure — users observe ChatGPT/Perplexity/Google AIO/Gemini/Claude themselves and submit observations via the dashboard form.
argument-hint: "use_case_id=<id>"
allowed-tools: Bash
---

You are running `pull:measure` for the **llm-seo-lab** plugin (v0.3.0).

This command **does not crawl any AI engine**. v0.3.0 deliberately removes automated measurement from the plugin (see `docs/v0.3.0/migration.md` and the deprecation envelopes on `track_citations` / `read_citation_trend`).

`/pull:measure` exists to:

1. Confirm the use case is in a measurable stage (`MEASURING` is canonical; `REPUBLISHED` is the prep stage).
2. Print the dashboard URL where the user enters observations.
3. Print the engine list and prompt suggestions for this iteration.

`$ARGUMENTS`: required `use_case_id`.

## Step 1 — load the use-case state

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/aeo-mcp.sh" read_use_case_state '{"use_case_id":"<USE_CASE_ID>"}'
```

Refuse to continue if the use case is not in `REPUBLISHED` or `MEASURING`. Tell the user which stage it *is* in and what action button to click.

## Step 2 — surface the entry surface

Print the following:

> The plugin does not crawl AI engines. Open the dashboard at:
>
> ```
> http://localhost:3000/use-cases/<USE_CASE_ID>/measurements/new
> ```
>
> For each engine you can reach (ChatGPT, Perplexity, Google AIO, Gemini, Claude.ai), run a citation-shaped prompt about the page's topic, then paste the engine's answer plus your observation (citation present? what position?) into the form.
>
> A useful prompt template:
>
> ```
> What is <TOPIC>? Cite your sources.
> ```
>
> Substitute `<TOPIC>` with the use case's `topic` field. The dashboard will write each observation to the `measurements` table; once you have at least three across at least two engines, click **Analyze** to generate an `analyses` row.

## Step 3 — print the recommended engine spread

From the `recommendations` rows in the bundle, collect the union of `expected_engines` across the current iteration's recs and print it as the engine list to test.

## Stop conditions

- The plugin will *never* fabricate observations. If the user asks you to "just simulate the answers", refuse and quote the Buddhi gate G2 from `docs/v0.3.0/spec.md`.
- If `read_use_case_state` returns `NOT_FOUND`, suggest the user open the dashboard and confirm the use case id.
