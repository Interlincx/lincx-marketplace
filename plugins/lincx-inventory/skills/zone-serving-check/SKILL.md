---
name: zone-serving-check
description: Use when the user asks which ads actually serve in a Lincx zone, why an offer is or isn't showing, or wants to reconcile serving against targeting — anything that calls get_zone_ads, especially with debug. Enforces the geo- and time-parameterised procedure required to read the debug candidate pool correctly and avoid false "missing offer" findings.
---

# Lincx — Zone serving check

Answer: "For zone Z, which offers would actually serve **right now, for this
visitor**, and if offer X is absent, why." Backed by `get_zone_ads`.

The single most important fact: **the debug candidate pool is the result of one
hypothetical ad request.** It is not the zone's roster. It is conditioned on geo,
on wall-clock time, and on per-group limits. An offer missing from one call is
not evidence of anything until you have varied those inputs.

## Inputs
- `zoneId` — required.
- Geo — **required in practice**, see below.
- `adFeedCount` — optional; defaults to the zone's own `adFeedCount`.

## Rule 1 — never call debug without geo

`get_zone_ads` accepts `geoCountry`, `geoState`, `geoPostal`, `geoCity`, `geoIP`.
Always send a coherent set:

```
get_zone_ads({ zoneId, debug: true,
               geoCountry: "US", geoState: "TX",
               geoPostal: "75201", geoCity: "Dallas" })
```

Without geo, two filters go unevaluated or misevaluate:

- **State targeting.** Most ad groups carry a `geo[]` allow-list of state codes.
- **Visitor dayparting.** `params.dateTimeVisitor` is expressed in the visitor's
  local time, which can only be derived from geo. A group carrying it can drop
  out of a no-geo call while being perfectly healthy.

A no-geo call is a valid smoke test that the endpoint responds. It is **not** a
valid basis for concluding an offer does not serve.

## Rule 2 — pick geo deliberately

Read the target group's `geo[]` first and choose a ZIP inside it. If you are
comparing two groups, pick a state that separates them — that is what turns a
guess into a proof. Run at least two geos before drawing any conclusion; a single
geo cannot distinguish "filtered" from "absent".

## Flow — "why is offer X not serving in zone Z"

Work in this order and stop as soon as one step explains it.

1. **`explain_serve({ zoneId, adGroupId })`** — the config verdict. If it returns
   `eligible: false`, the answer is in `reasons[]` and you are done. If `eligible:
   true`, the config is fine and the cause is runtime — continue.
2. **`get_ad_group({ id, include: ["parents"] })`** — read, in this order:
   - `enabled` and `archived`
   - `geo[]` — is your test geo in it?
   - `params.dateTimeUTC` / `params.dateTimeVisitor` — dayparting
   - `exceptParams` — especially `zoneId-position`, which blacklists specific slots
   - `impressionLimit`, `clickLimit`, `freqCappingQty`, `freqCappingDays`
3. **Check the daypart against the clock.** Tokens are `<day><hour>`, lowercase,
   no zero-pad: `thu16` is Thursday 16:00. Get the current UTC token with
   `date -u '+%a%-H' | tr 'A-Z' 'a-z'` and check membership in `dateTimeUTC`.
   If the group carries `dateTimeVisitor`, the same check applies in the
   visitor's local zone, so it can only pass when geo was supplied.
4. **Re-run `get_zone_ads` with debug and an in-list geo.** If the offer now
   appears, there is no defect — report the actual constraint.
5. **`get_zone_report({ id: zoneId, startDate, endDate })`** — ground truth. If
   the offer shows impressions and revenue, it demonstrably serves, and any
   remaining absence is a question about your request parameters, not about the
   offer.

## Rule 3 — do not reconcile debug against the targeting inventory

`get_zone_targeting_inventory` answers "what is config-reachable" — it applies no
geo, no clock, no limits. `get_zone_ads` answers "what wins one auction now."
**These counts are not supposed to match.** A live group absent from a single
debug call is the expected behaviour of geo and daypart filters doing their job.

Never report a count delta between the two tools as a finding. If you want to
reconcile, do it per-offer through the flow above.

## Rule 4 — do not infer a cap from the count

Candidate counts move with targeting: the same zone returned 10 / 9 / 7 across
no-geo, Ohio and Texas. A round number is not a cap. Test by varying geo and
comparing membership, not length. If you suspect a genuine cap, raise
`adFeedCount` and re-run.

## Rule 5 — the debug array is not a clean ranking

Entries are broadly score-descending, but positional exclusions
(`exceptParams["zoneId-position"]`) can reorder it, so an out-of-place first
entry is a known artefact. Sort by `score` yourself before presenting a ranking;
never read the array top-down and call element 0 the winner.

## Reporting

State the geo and UTC token every call was made under — a serving result without
its inputs is unreproducible. When an offer is absent, name the specific
constraint (`geo[] excludes OH`, `dateTimeUTC excludes thu09`) rather than
"missing". Distinguish verified from inferred: if you did not re-run under a
passing condition, say the explanation is unconfirmed.

For the worked example this procedure was derived from, see [reference.md](reference.md).

## Guardrails
- Never pass `networkId` — it is session-scoped upstream. Confirm the active
  network with `auth_status` first; a wrong network yields empty or foreign results.
- On `"Error: Not authenticated…"` surface it and ask the user to re-authenticate;
  do not retry. On `"Error: Resource not found…"` the zone or ad group ID is wrong
  — do not invent one. On `"Error: Forbidden…"` check the active network and offer
  to switch.
- `get_zone_ads` is a read against the live serving path. It is safe to repeat,
  but keep geo sets coherent (a ZIP that contradicts its state produces
  meaningless results).

## Out of scope
Free radicals and CAG-level leakage — use `get_zone_eligible_ad_groups`.
Historical performance — use `report_query` or `get_zone_report`.
