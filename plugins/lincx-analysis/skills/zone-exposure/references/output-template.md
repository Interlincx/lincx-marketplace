# Output template — the seven-part contract

Every exposure report is exactly seven parts in this order. Parts 1–4 and 6 are
observed/derived only; any inferred sentence anywhere carries `[inferred]`.
Part 5 is where inference lives.

## 1. Headline (≤ 25 words, one sentence)

The status split and the placement regime. Name the zone and the window.

> Zone `hh4x9w` 2026-08-01 → 2026-08-14: 9 of 31 eligible offers served; 4 ads and 1 group pinned; a 50 % segment runs a fixed order.

No hedging adjectives. No inference in the headline.

## 2. What this can and cannot tell you

The framing block from `inference-rules.md`, filled in for this zone. Two short
lists, **can** then **cannot**. Each *can* line is `[observed]` or `[derived]`
and cites the field. Each *cannot* line names the missing instrumentation.

## 3. Exposure table

The `summary` counts on one line, then one row per offer:

`status | adGroupId | adId | creativeId | via | impressions | revenue | rank_histogram (visual) | forced slot (server) | caveats`

- Sorted by status in enum order (`serving`, `eligible-never-surfaced`,
  `ineligible`, `not-evaluated`, `unknown`), then impressions desc.
- `rank_histogram` rendered as `r1:812 r2:340 r5:12`. `forced slot` rendered as
  `ad:2` / `group:1` / `—`. The two columns sit next to each other and are
  never combined.
- **Cap at 25 rows per status.** Past that, the top 25 by impressions and a
  line saying how many were omitted and which `bucket`/`offset` fetches them.
- If the user asked about a specific offer, its row comes first regardless of
  status, in bold, with every `caveats[]` entry quoted in full.
- `unmatchedDeliveryTotal > 0` gets its own line under the table: how many
  rows, and the tool's caveat on the likely cause.

## 4. Placement and today's probe

Two short blocks.

**Placement** `[observed]`: `adFeedCount`; the pins (`forcedAdPositions`,
`forcedAdGroups`) as `id → server slot`; every segment as `name @ N % ·
template · M forced entries`; `scoringStatsOverride`. Then one `[derived]`
line: pinned slots ÷ `adFeedCount`, and Σ `trafficAllocation` under a forced
order (R4).

**Probe** `[observed]`: geo it ran under, `candidates_returned`, `scored` /
`unscored`, `score_min` → `score_max`, `impressionsTotal` with
`candidate_impressions_sum` beside it. Then the candidate table, **sorted by
score desc**, unscored last and marked unranked:

`# | adId | name | score | impressions | cpm | boost | placement_source | forced slot (server)`

Cap at 25; state the omission.

## 5. Reads

Every sentence in this section carries a label and the rule that produced it.
Order: R5 (override) first if it applies, then R1, R2, R3.

- **Explore / exploit** — the `[derived]` medians on one line, then one
  `[inferred] R1` sentence per candidate the user asked about, or per
  candidate in the top and bottom three by score if none was named.
- **Crowd-out** — one entry per `unknown` row the user asked about (or the
  top 10 by ad group if none named), each resolved to R2a, R2b or R2c with
  the preconditions quoted. R2c entries have no `[inferred]` sentence; they
  list what was checked.
- **Tail placement** — one `[inferred] R3` sentence per `serving` row whose
  share at visual rank ≥ 4 is ≥ 80 %; otherwise one line saying no row
  qualifies.

If a rule was skipped (fewer than 4 scored candidates, empty
`rank_histogram`), say which and why, in one line.

## 6. Config touched in window

One line per entity checked (zone, target ad groups, target ads):

> `[observed]` ad group `y433xw`: config was touched on 2026-08-09 by `ops@example.com`; the contents of the change are not recorded.

or

> `[observed]` zone `hh4x9w`: `dateUpdated` 2026-06-30, outside the window.

Nothing else. No inference about what changed.

## 7. Footer (fixed format)

`Source: get_zone_exposure zone <zoneId> · <start> → <end> · dimension set <dimensionSetId> (ad: <resolved.ad>, rank: <resolved.rank|none>) · get_zone_candidates probed <YYYY-MM-DD HH:MM UTC> geo <country/state/postal|none> · observed/derived by the platform, inferred by Claude`

Append when they apply:

- `Note: no rank dimension resolved — rank_histogram is empty; R3 skipped.`
- `Note: rows paged — bucket <b>, <n> of <total> shown; summary counts are exact.`
- `Note: zone scored on <scoringStatsOverride.zoneId>'s stats — R1/R2b describe that zone's history.`
- `Note: eligibility here means "for some request" — dayparting, geo/devices and zoneId-position are not evaluated.`
- `Note: probe ran without geo — candidate absence is not evidence.`
- One `Note:` per zone-level `caveats[]` entry from either tool that affects a
  sentence in part 5, quoted from the tool. Row-level caveats stay in the table.

## Forbidden

- Emoji.
- First person.
- Filler: "based on the data", "the data shows", "as you can see".
- An unlabelled sentence that is not an observation.
- `unknown` reported as anything other than `unknown`.
- Any number produced by dividing by `impressionsTotal`.
- Any number produced by subtracting a visual rank from a server slot, or the
  reverse.
- "because" without `[inferred] R<n>` in the same sentence.
