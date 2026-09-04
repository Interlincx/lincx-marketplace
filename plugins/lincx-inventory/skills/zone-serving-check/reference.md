# Reference — the case this procedure came from

A worked example of the failure mode this skill exists to prevent: a healthy,
revenue-generating offer reported as a serving bug because the diagnostic call
was made without geo.

## The false finding

Zone `8z7wzb` (Quicken Loans Refinance - Match, Core Digital `7jdz0n`).

`get_zone_targeting_inventory` reported 83 targeted ad groups, 11 fully live.
`get_zone_ads({ zoneId: "8z7wzb", debug: true })` — **no geo parameters** —
returned 10 candidates. The one absent from the pool was `2q8meh`
(JG Wentworth - Debt Relief - QL Refinance - Match).

This was written up as a defect: a live offer missing from serving diagnostics.
Two supporting inferences were also wrong.

- **"The pool is capped at 10."** It is not. The same zone returned 9 for Ohio
  and 7 for Texas. The count tracks targeting, not a limit.
- **"11 live vs 10 serving is a discrepancy."** It is not. The two tools answer
  different questions; see Rule 3.

## What the offer's config actually said

`get_ad_group({ id: "2q8meh" })`:

```
enabled: true
geo: [AL, AK, AZ, AR, CA, CO, FL, ID, IN, IA, KY, LA, MD, MA, MI, MS,
      MT, NE, NV, NM, NY, NC, OK, PA, SD, TN, TX, UT, VA, DC, WI]
params.zoneId:          ["8z7wzb", "t64lvh"]
params.dateTimeUTC:     ["thu0","thu1","thu13"…"thu23", …]
params.dateTimeVisitor: ["thu8"…"thu20", …]
exceptParams["zoneId-position"]: ["8z7wzb-1"]
```

Two things stand out. Texas is in the allow-list and Ohio is not. And it is the
only one of the eleven live groups carrying **dayparting** — including
`dateTimeVisitor`, which cannot be evaluated without a visitor timezone, which
cannot be derived without geo.

`explain_serve({ zoneId: "8z7wzb", adGroupId: "2q8meh" })` returned
`eligible: true`, `reasons: []` — confirming config was never the problem.

## The two calls that settled it

Dallas, TX (in the allow-list):

```
get_zone_ads({ zoneId: "8z7wzb", debug: true, geoCountry: "US",
               geoState: "TX", geoPostal: "75201", geoCity: "Dallas" })
```

7 candidates. `2q8meh` **present**, score 1.389, CPM 214.81. No defect.

Columbus, OH (not in the allow-list):

```
get_zone_ads({ zoneId: "8z7wzb", debug: true, geoCountry: "US",
               geoState: "OH", geoPostal: "43215", geoCity: "Columbus" })
```

9 candidates. `2q8meh` **absent** — correctly, per its `geo[]`.

## The control that proves geo is applied

`cb1v4z` (Hometap) has `geo` = `[AZ, CA, FL, IN, MI, MO, NV, NY, NJ, OH, PA, SC,
UT, VA, OR, GA, MT, TN, ID, DE]` — Ohio yes, Texas no. It appeared in the
Columbus call and vanished in the Dallas one. Exactly inverse to `2q8meh`, exactly
as both configs specify. Geo filtering works.

## Ground truth

`get_zone_report({ id: "8z7wzb", startDate: "2026-09-01", endDate: "2026-09-02" })`
showed `2q8meh` delivering on both days — $52 / 259 impressions on Sept 1,
$117 / 235 on Sept 2. It had been serving and earning the entire time.

## Residual open question

The no-geo absence is best explained by `dateTimeVisitor` failing without a
resolvable visitor timezone. `2q8meh` was the only live group carrying dayparting
and the only one that dropped out, and the UTC axis was permissive at the time
(`thu16` is in its `dateTimeUTC` list), so the visitor axis is the remaining
candidate.

This is **inference, not proof**. Confirming it needs either a second
daypart-carrying group showing the same behaviour, or a run at a UTC hour outside
the allow-list to watch the offer drop out even with geo supplied. Stated as
inference in any report until then.

## The ordering artefact

In the Dallas response, entries 2–7 descend cleanly by score (1.389 → 0.583),
but element 0 was `jncprm` at 0.597 — out of place. The Ohio and no-geo responses
were cleanly sorted. `2q8meh` carries `exceptParams["zoneId-position"]:
["8z7wzb-1"]`, so a positional exclusion reshuffling the array is the likely
cause. Cosmetic, but it misleads anyone reading the debug output as a ranking.
Hence Rule 5.

## Cost of the error

One filed bug that did not exist, two wrong supporting claims, and an engineer's
time spent looking for a fault in the serving path. The whole thing was avoidable
with four query parameters.
