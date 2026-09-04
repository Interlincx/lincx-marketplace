---
name: zone-exposure
description: Use when the user asks why an eligible offer is not surfacing in a Lincx zone, which offers are crowded out, whether an offer is in explore or exploit, or what changed a zone's exposure.
---

# Lincx — Zone exposure diagnostics

You read two platform tools and write the diagnosis on top of them.

- `get_zone_exposure` — the join. Config eligibility ⟕ delivery rows ⟕ placement
  config, one row per (ad group × ad × creative), each with a **status enum**.
- `get_zone_candidates` — the probe. The live scoring snapshot: each considered
  candidate's `score`, `impressions`, `cpm`, `boost` and `placement_source`.

**The numbers are the platform's; the prose is yours.** Both tools emit only
`observed` and `derived` fields — no field can say "crowded out" or "in explore".
Those words exist only in this skill, and only carrying a label. Read
`references/inference-rules.md` before writing a line; it is the full set of
inferences you are allowed to make, the thresholds they use, and the four things
you must never say.

## The one structural rule

**Every claim is labelled at the sentence level:** `[observed]`, `[derived]` or
`[inferred]`. Observed = a field the tool returned. Derived = arithmetic on
observed fields by a rule you can state in the same sentence. Inferred = a
heuristic from `inference-rules.md`. A sentence with no label is a sentence
that must be observed; if it is not, add the label or delete the sentence.

## Flow

1. **Resolve inputs.** `zoneId` (6 lowercase alphanumerics), `startDate`,
   `endDate` (`YYYY-MM-DD`), optionally one or more target `adGroupId` / `adId`
   the user is asking about. **If the user did not give a date range, ask. Never
   default one.** Exposure is a window question; a window you invented is a
   diagnosis the user cannot audit.

2. **Resolve the dimension set.** `get_zone_exposure` needs a `dimensionSetId`.
   Call `list_dimension_sets`, then `get_dimension_set` on likely candidates, and
   pick the set whose `dimensions[]` carries a **zone** dimension, an **ad**
   dimension, and — if any set has it — a **rank** dimension. Without rank the
   join still runs but `rank_histogram` is empty and every rank read below is
   off the table; say so in the footer. If two sets qualify equally, ask which
   one the user reports from; do not pick silently.

3. **Run the join:**

   ```
   get_zone_exposure({ zoneId, dimensionSetId, startDate, endDate })
   ```

   The tool returns a one-line header, a blank line, then compact JSON. Parse
   everything after the first blank line. Read `caveats[]` first — the tool
   ships its own honesty gaps as data, and every one of them applies to your
   output. Then `summary`, `placement`, `delivery_dimensions`, `rows`.

   **Paging.** `summary` is exact over the whole zone at every page. If
   `page.next_offset` is present, re-run with that `offset` and the same
   `bucket` until it is absent. Page on the absence of `next_offset`, never on
   `complete`. If the zone is large, narrow with `bucket` to the status the
   question is about (`unknown` for "why isn't X surfacing", `serving` for
   rank reads) rather than paging through everything.

   **Empty join.** If `delivery_dimensions.rowsForZone` is 0, every row's
   `delivery` is null and the tool's caveat says so. That is an empty join, not
   "nothing served". Check `delivery_dimensions.available` against `resolved`,
   pass `dimensions: { ad: '…', zone: '…' }` overrides if a better name exists,
   and re-run once. If it is still empty, report it as such and stop the rank
   analysis there.

4. **Run the probe:**

   ```
   get_zone_candidates({ zoneId, geoCountry, geoState, geoPostal, geoCity })
   ```

   Pass a coherent geo whenever the target ad group carries `geo[]`; read it off
   the exposure row's `reasons`/`conflicts` or `get_ad_group` first. A no-geo
   probe is a valid smoke test and an invalid basis for "not in the candidate
   set". State the geo the probe ran under in the footer. It is a synthetic
   probe of **now**; the join is a window in the **past**. They are two
   different clocks and you may not treat one as evidence about the other
   without labelling the sentence `[inferred]`.

5. **Coarse config-change read (B4).** For the zone and for each target ad
   group / ad, read `dateUpdated` and `userUpdated` from `get_zone`,
   `get_ad_group`, `get_ad`. If `dateUpdated` falls inside `[startDate,
   endDate]`, report exactly: *"config was touched on `<dateUpdated>` by
   `<userUpdated>`; the contents of the change are not recorded."* Config has
   no history, so that sentence is the whole answer to "what changed". Never
   extend it.

6. **Write the report** per `references/output-template.md`.

## What the payloads contain

`get_zone_exposure`:
- `summary` — `offers`, `unmatchedDeliveryRows`, and a count per status:
  `serving` | `eligible-never-surfaced` | `ineligible` | `not-evaluated` | `unknown`
- `placement` — `adFeedCount`, `forcedAdPositions`, `forcedAdGroups`,
  `segmentsStatus`, `segments[]` (each with `name`, `trafficAllocation`,
  `templateId`, its own `forcedAdPositions` / `forcedAdGroups`),
  `scoringStatsOverride`, `segments_carry_forced_order`.
  `slot_basis: 'server'`.
- `rows[]` — `adGroupId`, `adId`, `creativeId`, `status`, `eligible`, `live`,
  `via`, `reasons`, `conflicts`, `delivery { metrics, rank_histogram,
  slot_basis: 'visual', join_basis }` or null, `forced { adSlot, adGroupSlot,
  slot_basis: 'server' }` or null, `caveats[]`
- `zone_totals` — the zone's summed metrics over the window
- `unmatchedDelivery[]` / `unmatchedDeliveryTotal` — delivery rows no config
  row claimed. Never dropped, never yours to explain away.

`get_zone_candidates`:
- `zone_probe` — `impressionsTotal`, `candidate_impressions_sum`,
  `impressionsTotal_is_opportunity_denominator: false`, `candidates_returned`,
  `scored`, `unscored`, `score_min`, `score_max`
- `candidates[]` — `id`, `name`, `score` (may be null), `impressions`, `cpm`,
  `boost` (may be null), `placement_source`
  (`forced-ad` | `forced-group` | `segment-forced` | `boosted` | `scored`),
  `forced_slot`, `segment_forced_by[]`
- `caveats[]` — read them; the ones that bite go in the footer's `Note:` lines

## Guardrails

- Never pass `networkId` — session-scoped upstream. Confirm the active network
  with `auth_status` if results look foreign.
- Never recompute a status. If a row's status looks wrong against its own
  fields, that is a finding to report with the fields quoted, not a value to fix.
- `status: 'unknown'` is the normal case and is **not** a finding. Do not
  write "eligible but never surfaced" about an `unknown` row; the enum has that
  value and the tool did not emit it.
- On `"Error: Not authenticated…"` surface it and ask the user to run
  `auth_login`; do not retry, do not run it for them.
- On a `get_zone_exposure` error naming the dimensions the set carries, the set
  has no zone or ad dimension — go back to step 2 with a different set.
- On `complete: false` with an ids-only `note`, one offer row exceeded the
  budget. Re-run with a `bucket` and say so.
- If `get_zone_exposure` or `get_zone_candidates` is not in the connected MCP's
  tool list, say the MCP is behind rungs 1–2 of the exposure plan and stop.
  `get_zone_ads({ debug: true })` is not a substitute: it has no
  `placement_source` and its caveats are not data.
