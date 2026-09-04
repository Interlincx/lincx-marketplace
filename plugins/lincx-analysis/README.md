# lincx-analysis

Zone analysis over the Lincx MCP — tier analysis and exposure diagnostics.

Ask "how should zone `abc123` be tiered for June?" and get a tier structure, per-tier
creative tables, risk flags, and a prioritized action list — with every number computed
by the platform and every sentence written by Claude.

## The split

The Lincx platform already runs a deterministic tiering engine: aggregation,
reliability-weighted CPM, waterfall rank collapse, percentile tier banding. It also has
a server-side Gemini pass that writes narrative on top — but that pass can't change a
single number, because the engine overwrites every metric the model emits.

So this plugin skips it. `create_analysis` defaults to `noLLM: true`, the engine result
comes back with the narrative fields empty, and Claude fills them in using the grounding
rules in `skills/lincx-zone-tiering/references/tiering-rules.md`.

What that buys:

- **No second LLM bill.** One analysis, one model — the one you're already talking to.
- **The prompt is a markdown file.** Tiering rules change; edit the reference, reload the
  plugin. No server deploy.
- **The MCP stays dumb.** Three thin tools, no prompt logic, usable by any client.

## Skills

| Skill | Covers |
|---|---|
| `lincx-zone-tiering` | Both analysis types — `offerTiering` (which creatives belong in which tier) and `rankedOfferOptimization` (which offer belongs in which rank slot). |
| `zone-exposure` | Why an eligible offer is or isn't surfacing in a zone. Reads `get_zone_exposure` (the eligibility ⟕ delivery ⟕ placement join) and `get_zone_candidates` (the live scoring probe) and writes the crowd-out, explore/exploit and tail-placement reads on top. |

## Commands

```
/zone-tiering abc123 2026-06-01 2026-06-30
/zone-tiering abc123 2026-06-01 2026-06-30 ranked
/zone-exposure hh4x9w 2026-08-01 2026-08-14
/zone-exposure hh4x9w 2026-08-01 2026-08-14 y433xw TX 75201
```

Arguments are optional and order-independent — a 6-character token is the zone (further
ones are the offers you're asking about), ISO dates are the range, `tiering`/`ranked` picks
the tiering type, a state code and ZIP set the probe geo. Anything missing gets asked for.
The date range is never defaulted.

## The observed / derived / inferred rule

`zone-exposure` is the narrative layer of the Zone Exposure Diagnostics plan
(`docs/superpowers/specs/2026-08-10-zone-exposure-diagnostics-design.md`, rung 3). The two
tools it reads emit only observed and derived fields and a status enum whose ambiguous
value is `unknown`. Inference — "crowded out", "in explore", "tail-placed" — exists only in
`skills/zone-exposure/references/inference-rules.md`, each rule with a stated threshold,
and every sentence it produces is labelled `[inferred]` with the rule number. A tool cannot
write "because it performs badly" if it has no field for it; the skill can, so it must say
so.

The coarse "what changed" answer ships here too: `dateUpdated` / `userUpdated` on zone, ad
group and ad are free, so *"config was touched on `<date>` by `<user>`; the contents of the
change are not recorded"* is reported as-is. What changed is blocked on config history.

## Install

```
/plugin marketplace add zakasalaheddine/lincx-marketplace
/plugin install lincx-analysis@lincx-marketplace
/reload-plugins
```

## Requirements

- The **Lincx MCP** connected to your session, at a version that ships
  `create_analysis` / `get_analysis` / `list_analyses` (tiering) and `get_zone_exposure` /
  `get_zone_candidates` (exposure). Run `/mcp` to confirm.
- **Analysis access.** These endpoints are gated by an email allowlist upstream
  (`server/analysis-allowlist.js` in lincx-core), separate from network permissions. A
  403 means you're not on it — ask the platform team, not your network admin.

## How tiering runs

1. `create_analysis` queues a job and returns immediately with an id.
2. The skill polls `get_analysis` — bounded at 10 attempts, then it hands you the id
   rather than looping.
3. On `succeeded`, it parses the payload and writes the report per
   `references/output-template.md`.

Analyses are asynchronous because the underlying ClickHouse query and pipeline take
real time. A wide zone over a long window is the slow case; if polling times out, the
job is still running and `get_analysis` on that id will have it later.

## How exposure runs

1. `list_dimension_sets` / `get_dimension_set` to pick a set carrying zone, ad and (if any
   does) rank dimensions — the join needs to know which report dimension carries which key.
2. `get_zone_exposure` for the window, paged on the absence of `next_offset`, narrowed with
   `bucket` when the question is about one status.
3. `get_zone_candidates` with a coherent geo for the probe of *now*.
4. `get_zone` / `get_ad_group` / `get_ad` for `dateUpdated` inside the window.
5. The seven-part report per `references/output-template.md`.

## Development

```
npm test                 # lint + unit tests
npm run sync-mcp-tools   # regenerate tests/fixtures/mcp-tools.json from ../../../mcp
```

`tests/tool-references.test.mjs` fails the build if a skill references an MCP tool that
doesn't exist in the snapshot — which is what keeps the docs honest when the MCP moves.
