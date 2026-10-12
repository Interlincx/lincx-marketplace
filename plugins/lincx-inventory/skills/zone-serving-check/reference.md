# Reference — the case this procedure came from

A worked example of the failure mode this skill exists to prevent: a healthy,
revenue-generating offer reported as a serving bug because one diagnostic call was
read as the zone's roster.

Every `get_zone_ads` call below used `debug: true`. Read them as Rules 1–2
describe a debug call: a `geoState` that is not an uppercase state code becomes
`CA`, the clock is the server's UTC time (so `dateTimeVisitor` equals
`dateTimeUTC`), no device is set, and `adFeedCount` is 1000 — except on a
segments-on zone, where it is that of whichever candidate is picked (a segment's
own, or the zone's own when the zone itself is picked), and 1000 when it has
none.

## The false finding

Zone `8z7wzb` (Quicken Loans Refinance - Match, Core Digital `7jdz0n`).

`get_zone_targeting_inventory` reported 83 targeted ad groups, 11 fully live.
`get_zone_ads({ network_id, zoneId: "8z7wzb", debug: true })` — **no geo
parameters**, so in fact a California visit — returned 10 candidates. The one
absent from the pool was `2q8meh` (JG Wentworth - Debt Relief - QL Refinance -
Match).

This was written up as a defect: a live offer missing from serving diagnostics.
Two supporting inferences were also wrong.

- **"The pool is capped at 10."** Not shown — the debug endpoint returns up to
  1000, or, on a segments-on zone, the picked candidate's `adFeedCount` (1000 when
  it has none). The same zone returned 9 for Ohio and 7 for Texas, so the count
  tracked targeting there.
- **"11 live vs 10 serving is a discrepancy."** It is not. The two tools answer
  different questions; see Rule 4.

## What the offer's config actually said

`get_ad_group({ network_id, id: "2q8meh" })`:

```
enabled: true
geo: [AL, AK, AZ, AR, CA, CO, FL, ID, IN, IA, KY, LA, MD, MA, MI, MS,
      MT, NE, NV, NM, NY, NC, OK, PA, SD, TN, TX, UT, VA, DC, WI]
params.zoneId:          ["8z7wzb", "t64lvh"]
params.dateTimeUTC:     ["thu0","thu1","thu13"…"thu23", …]
params.dateTimeVisitor: ["thu8"…"thu20", …]
exceptParams["zoneId-position"]: ["8z7wzb-1"]
```

Texas is in the allow-list and Ohio is not. It was also the only one of the eleven
live groups carrying **dayparting**.

`explain_serve({ network_id, zoneId: "8z7wzb", adGroupId: "2q8meh" })` returned
`eligible: true`, `reasons: []` at the time, when the eligibility tools read
`zoneId` alone. Today the same config returns `verdict: "conditional"`
(`eligible: false`, `reasons: []`) with `conditions[]` requiring `geoState` (from
`geo`), `dateTimeUTC` and `dateTimeVisitor` — read `conditions[]`, not
`reasons[]`, on a conditional verdict.

## The two calls that settled it

Both states are valid uppercase codes, so the debug endpoint kept them as sent.

Dallas, TX (in the allow-list):

```
get_zone_ads({ network_id, zoneId: "8z7wzb", debug: true, geoCountry: "US",
               geoState: "TX", geoPostal: "75201", geoCity: "Dallas" })
```

7 candidates. `2q8meh` **present**, score 1.389, CPM 214.81. No defect.

Columbus, OH (not in the allow-list):

```
get_zone_ads({ network_id, zoneId: "8z7wzb", debug: true, geoCountry: "US",
               geoState: "OH", geoPostal: "43215", geoCity: "Columbus" })
```

9 candidates. `2q8meh` **absent** — correctly, per its `geo[]`.

## The control that proves geo is applied

`cb1v4z` (Hometap) has `geo` = `[AZ, CA, FL, IN, MI, MO, NV, NY, NJ, OH, PA, SC,
UT, VA, OR, GA, MT, TN, ID, DE]` — Ohio yes, Texas no. It appeared in the
Columbus call and vanished in the Dallas one. Exactly inverse to `2q8meh`, exactly
as both configs specify. Geo filtering works.

## Ground truth

`get_zone_report({ network_id, id: "8z7wzb", startDate: "2026-09-01", endDate: "2026-09-02" })`
showed `2q8meh` delivering on both days — $52 / 259 impressions on Sept 1,
$117 / 235 on Sept 2. It had been serving and earning the entire time.

## The no-geo absence is unexplained

This was first put down to `dateTimeVisitor` failing without a geo-derived
timezone. That is wrong: `dateTimeVisitor` comes from the request's timestamp,
never from geo, and the debug endpoint sets it to the server's UTC time. The
no-geo call was a California visit at `thu16` UTC. Against the recorded config,
CA is in `2q8meh`'s `geo[]`, `thu16` is in its `dateTimeUTC` list, and `thu16`
falls inside its `dateTimeVisitor` list only if the recorded `"thu8"…"thu20"` is
contiguous. Only geo and daypart were checked, and only against those recorded
lists; the live config was not re-read.

So the absence may have come from something outside geo and daypart — another
rule, a runtime filter such as an event limit or a `keyValueLimits` cap, or the
debug endpoint itself — and the record does not say which. One unchecked lead:
the call returned exactly 10, and if zone `8z7wzb` has segments on and the picked
candidate — a segment, or the zone itself — has an `adFeedCount` of 10, the pool
was cut at 10 and `2q8meh` may simply have ranked below it. It is
**unresolved**; do not cite it as an example of any particular cause.

## The ordering artefact

In the Dallas response, entries 2–7 descend cleanly by score (1.389 → 0.583),
but element 0 was `jncprm` at 0.597 — out of place. `2q8meh` carries
`exceptParams["zoneId-position"]: ["8z7wzb-1"]`, so a positional exclusion
reshuffling the array is the likely cause. Hence Rule 6.

## Cost of the error

One filed bug that did not exist, two wrong supporting claims, a wrong root cause
in this very reference, and an engineer's time spent looking for a fault in the
serving path. Reading the config verdict first, and sending an uppercase state
with every debug call, avoids all of it.
