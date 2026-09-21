# lincx-analysis

Zone tier analysis over the Lincx MCP.

Ask "how should zone `abc123` be tiered for June?" and get a tier structure, per-tier
creative tables, risk flags, and a prioritized action list — with every number computed
by the platform and every sentence written by Claude.

The MCP is read-only, so the analysis itself is started from the Lincx UI. This plugin
finds the run that already covers the zone and window you asked about, and writes the
report on it.

## The split

The Lincx platform already runs a deterministic tiering engine: aggregation,
reliability-weighted CPM, waterfall rank collapse, percentile tier banding. It also has
a server-side Gemini pass that writes narrative on top — but that pass can't change a
single number, because the engine overwrites every metric the model emits.

So this plugin skips it. An analysis queued with `noLLM` comes back with the narrative
fields empty, and Claude fills them in using the grounding rules in
`skills/lincx-zone-tiering/references/tiering-rules.md`.

What that buys:

- **No second LLM bill.** One analysis, one model — the one you're already talking to.
- **The prompt is a markdown file.** Tiering rules change; edit the reference, reload the
  plugin. No server deploy.
- **The MCP stays dumb.** Three thin tools, no prompt logic, usable by any client.

## Skill

| Skill | Covers |
|---|---|
| `lincx-zone-tiering` | Both analysis types — `offerTiering` (which creatives belong in which tier) and `rankedOfferOptimization` (which offer belongs in which rank slot). |

## Command

```
/zone-tiering abc123 2026-06-01 2026-06-30
/zone-tiering abc123 2026-06-01 2026-06-30 ranked
```

Arguments are optional and order-independent — a 6-character token is the zone, ISO
dates are the range, `tiering`/`ranked` picks the type. Anything missing gets asked for.
The date range is never defaulted.

## Install

```
/plugin marketplace add Interlincx/lincx-marketplace
/plugin install lincx-analysis@lincx-marketplace
/reload-plugins
```

## Requirements

- The **Lincx MCP** connected to your session, at a version that ships `list_analyses`
  / `get_analysis`. Run `/mcp` to confirm. There is no tool for starting an analysis —
  the one that did was removed upstream on 2026-09-04 as the only non-read-only
  business tool, so analyses are started from the Lincx UI.
- **Analysis access.** These endpoints are gated by an email allowlist upstream
  (`server/analysis-allowlist.js` in lincx-core), separate from network permissions. A
  403 means you're not on it — ask the platform team, not your network admin.

## How it runs

1. `list_analyses` finds succeeded runs on the network, newest first; the skill matches
   on the row's `analysisType` and its `request.zoneId` / `dateStart` / `dateEnd`.
2. `get_analysis` reads that run's payload.
3. It parses the payload and writes the report per `references/output-template.md`.

If nothing matches, the skill says so instead of reporting on a neighbouring window.
Analyses are asynchronous — the underlying ClickHouse query and pipeline take real
time — so a run started in the UI a moment ago may still be `queued`/`running`, and
those documents carry no results at all.

## Development

```
npm test                                  # lint + unit tests + the repo-wide tool check
node ../../scripts/sync-mcp-tools.mjs     # regenerate the root mcp-tools.json
```

`npm test` fails the build if a skill references an MCP tool that isn't in
`mcp-tools.json` at the repo root — one snapshot shared by every plugin, which is what
keeps the docs honest when the MCP moves.
