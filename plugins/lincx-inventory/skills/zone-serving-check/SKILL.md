---
name: zone-serving-check
description: Use when the user asks which ads actually serve in a Lincx zone, why an offer is or isn't showing, or wants to reconcile serving against targeting — anything that calls explain_serve or get_zone_ads, especially with debug. Enforces reading the config verdict first and the geo-parameterised debug procedure, to avoid false "missing offer" findings.
---

# Lincx — Zone serving check

Answer: "For zone Z, which offers would actually serve, **for which visits**,
and if offer X is absent, why." Backed by `explain_serve` (config) and
`get_zone_ads` with `debug: true` (the candidate pool).

The single most important fact: **the debug candidate pool is the result of one
hypothetical ad request.** It is not the zone's roster. It is conditioned on the
state you send, on the server's clock, on having no device, and on per-group
limits. An offer missing from one call is not evidence of anything until you know
that request could have passed the offer's rules.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Inputs
- `network_id` — required, see Network above.
- `zoneId` — required.
- `adGroupId` or `adId` — when the question is about one offer.
- Geo — an uppercase state code is **required** for every debug call, see Rule 1.
- `adFeedCount` — ignored on debug; it only bounds a live call.

## Rule 1 — never call debug without an uppercase state code

The debug endpoint replaces any `geoState` that is not an uppercase US state
code — missing, lowercase `tx`, or a name like `Texas` — with `CA`, silently. A
no-geo debug call is a **California** visit, not a visit without geo. Always send
a coherent set with an uppercase state:

```
get_zone_ads({ network_id, zoneId, debug: true,
               geoCountry: "US", geoState: "TX",
               geoPostal: "75201", geoCity: "Dallas" })
```

A ZIP that contradicts its state produces meaningless results.

## Rule 2 — know what a debug call is

`get_zone_ads({ network_id, zoneId, debug: true })` runs the same selection as
real serving, as **one request** with:

- `geoState`: the uppercase code you sent (Rule 1).
- **No `device` or `deviceOs`.** A group whitelisting a device (`params.device`,
  legacy `devices`, `params.deviceOs`) never appears; one blacklisting a device
  (e.g. never on mobile) appears anyway. Even a whitelist naming all seven
  devices, which `explain_serve` treats as no rule, fails here. Debug cannot test
  device targeting — read `explain_serve`'s `conditions[]` for that.
- The server's current UTC hour for every `dateTime*` key — the tool cannot send a
  timestamp, so `dateTimeVisitor` equals `dateTimeUTC` here, unlike a real visitor
  whose browser sends local time.
- No visitor, so frequency caps are skipped.

The pool holds up to 1000 ads. On a segments-on zone the cap is instead the
`adFeedCount` of whichever candidate is picked — the segment's own, or the zone's
own when the zone itself is picked — and 1000 when it has none. A
tiering-enabled template returns every ad regardless.

Each entry is one ad per ad group, with `score`, `cpm`, `impressions` and its ad
group as `name:id`; the response adds `impressionsTotal` and `maxCPM`. It does
not say which template or segment was picked. The segment draw is random, and so
is the pick among an ad group's equally scored ads, so repeat a call before
reading anything into a single absence. Debug also requires the caller to be a
member or owner of the zone's network; otherwise it answers `ACCESS DENIED`.

**The live call** (`debug` omitted) is a desktop visit (`deviceOs: other`) with
the geo as sent (`''` when none, failing every geo whitelist), the same server
UTC clock, and a fresh visitor (never capped). It returns only the winners — up
to the zone's or picked segment's `adFeedCount`, or all of them on a
tiering-enabled template — as creative payloads with `adId` / `adGroupId`, plus
the `template` and `segmentId` / `segmentName` picked, and **no scores**. Use it
only to confirm what a desktop visitor actually receives, or which segment and
template were picked.

## Rule 3 — pick the geo deliberately

Pick it from the offer's own rules (`conditions[]` from `explain_serve`, or its
`geo[]`): choose a ZIP inside them. If you are comparing two groups, pick a state
that separates them — that is what turns a guess into a proof. Run at least two
geos before drawing any conclusion; a single geo cannot distinguish "filtered"
from "absent".

## Flow — "why is offer X not serving in zone Z"

Work in this order and stop as soon as one step explains it.

1. **`explain_serve({ network_id, zoneId, adGroupId })`** (or `adId` for one ad)
   — the config verdict. The result is a one-line header, a blank line, then
   JSON. **Branch on `verdict`, never on `eligible`**: `eligible` is `false` for
   both `conditional` and `excluded`, and a conditional row has an empty
   `reasons[]`.
   - **One line, no JSON** — the zone itself serves nothing: it is archived, its
     channel is missing, or it has segments on, no segments, and fails its own
     lists. That line is the answer for every ad group; stop.
   - **`excluded`** — config keeps it out of every visit that leaves the zone's
     defaults alone. The answer is `reasons[]` plus `paramBlocks[]` (which rule,
     the zone's `actual` value). A block with `overridable: true` sits on a zone
     default: a visit overriding that key (tag `data-*` attribute, `lincx-` /
     `adverse-` / `tgt-` page param, or a page-URL-mapped key) would let it
     through — say so. `contradiction: <key>` means its rules on that key never
     hold on one visit (`contradictionOverridable: true`: only the segment pick
     causes it). Stop.
   - **`conditional`** — it serves on some visits only, and `conditions[]` says
     which. `op: 'requires'`: the visit's `key` must hold one of `values`.
     `op: 'excludes'`: every visit except those. All conditions must hold
     together; `valuesTotal > values.length` means the list was cut. A
     `source: 'segment'` condition holds on visits that land on a `candidates[]`
     entry with `passes: true` (`segmentId: null` is the zone itself; each
     candidate also names its `segmentName` and `templateId`). Name the visits it
     serves on, then check whether a debug call (Rule 2) can meet them before
     step 5.
   - **`eligible`** — the group's config is fine; the cause is runtime, or the
     ads' own rules — continue. Eligible covers the group's rules only; each ad
     is judged on its own, so a group whose ads are all geo-only stays eligible.
     Check the ads with `explain_serve` per `adId` (its conditions only, not
     whether the ad is live — check `enabled` with `get_ad`), or the group's
     `offers.live` / `offers.conditionalAds` in `get_zone_eligible_ad_groups`. If
     `matchedKeys[]` has an entry with `source: 'zone-default'` or `'segment'`,
     it holds only while the visit leaves that key alone — say so.

   With `adId`, the top-level `verdict`, `reasons`, `conditions`, `paramBlocks`,
   `matchedKeys`, `contradiction` and `excludedByDefault` are the ad × group
   pair's — read the top level; `offer` holds the ad's own rules alone. Read the
   path from `via[]` (group) or `offer.scoped_via[]` in the JSON, not from the
   header text. If the header carries a **NOTE**, the zone serves only some
   visits: `zone.refusesDefaultVisits` (visits keeping the defaults get no ad;
   only those overriding `zone.overriddenOnServedVisits` are served) or
   `zone.servesOnlyPinnedVisits` (only visits naming a `segmentId`). Lead with
   that.

   What a real visit carries: `device` and `deviceOs` from the user agent
   (desktop / other when it says nothing); `geoState` from the tag's
   `data-geo-state`, else the geo-lookup region code (uppercase, e.g. `TX`), or
   `''` when the lookup finds no region — which fails every `geoState` / `geo`
   whitelist; a lowercase `params.geoState` rule like `tx` never matches; and the
   `dateTime*` keys from the visit's timestamp — `dateTimeUTC` / `dateTimeUS/*`
   in their fixed zones, `dateTimeVisitor` in the browser's own offset (not its
   geo).
2. **`get_ad_group({ network_id, id, include: ["parents"] })`** — read, in this
   order:
   - `enabled` and `archived`, and the parent campaign's `enabled` and
     `dateStart` / `dateEnd` (`dateEnd` inclusive, in UTC)
   - `geo[]` — is your test geo in it?
   - dayparting — `params.dateTimeVisitor` or
     `params.dateTimeUS/Eastern|Central|Mountain|Pacific`, plus legacy
     `params.dateTimeUTC`, which old groups can still carry next to a newer key.
     A list of all 168 day-hours is no dayparting.
   - `exceptParams` — especially `zoneId-position`, which blacklists specific
     slots
   - `impressionLimit`, `clickLimit`, `freqCappingQty`, `freqCappingDays`
3. **Check the daypart against the clock.** Tokens are `<day><hour>`, lowercase,
   no zero-pad: `thu16` is Thursday 16:00. Get the current token in the key's
   zone, e.g. `date -u '+%a%-H' | tr 'A-Z' 'a-z'` for `dateTimeUTC`,
   `TZ=America/New_York date '+%a%-H' | tr 'A-Z' 'a-z'` for `dateTimeUS/Eastern`.
   `dateTimeVisitor` is each visitor's own clock; on a `get_zone_ads` call (debug
   or live) it is the UTC token.
4. **Rule out the runtime filters** an eligible group still faces: ad `enabled` /
   `archived` and a resolving creative; frequency caps (real repeat visitors only
   — they never apply to a `get_zone_ads` call, Rule 2); daily / weekly /
   monthly / date-range impression, click and action limits on the group and the
   ad; `keyValueLimits` caps; `testCreatives` / `minTrafficAllocation` narrowing
   the group to one ad; forced ad groups / positions on the zone or segment. Only
   one ad per ad group serves on a visit.
5. **Re-run `get_zone_ads` with `debug: true` and an in-list uppercase state** —
   only when the offer's conditions are ones a debug call can meet (Rule 2: no
   device rule it needs, the current UTC hour). If the offer appears in the pool,
   there is no defect — report the actual constraint. If it needs a device or OS,
   or another hour, debug cannot test it; say so and go to step 6.
6. **`get_zone_report({ network_id, id: zoneId, startDate, endDate })`** — ground
   truth. If the offer shows impressions and revenue, it demonstrably serves, and
   any remaining absence is a question about your request parameters, not about
   the offer.

## Rule 4 — do not reconcile debug against the targeting inventory

`get_zone_targeting_inventory` answers "what is config-reachable" — it applies no
geo, no clock, no limits. Debug answers "what survives one request now."
**These counts are not supposed to match.** A live group absent from a single
debug call is the expected behaviour of geo, device and daypart filters doing
their job.

Never report a count delta between the two tools as a finding. If you want to
reconcile, do it per-offer through the flow above.

Its `fully_live` also ignores a group's rules beyond `zoneId` (and a CAG
mismatch), and counts an ad that serves only some visits (e.g. geo-only) as live,
so its live count can exceed `get_zone_eligible_ad_groups`'
`directlyTargetedLive` on the same zone, by design. The gap is the targeted
groups reading `fully_live: true` that tool reports as `excluded` or
`conditional`, plus those in `directlyTargetedLiveOnConditionalAds` — eligible
groups whose live ads all depend on the visit (e.g. every ad geo-only); for those,
the row's `offers.conditionalAds` lists up to 10 of its visit-dependent ads with
their conditions, live or not, so check an ad's state before naming it as the one
that serves. When `offers.conditional` exceeds the list's length the list may be
cut, or may skip offers that are conditional only through the group's own rules
(no ad-level conditions), so the live ad may not be in it — read the group's ads
with `list_ads` / `get_ad`.

The count can also include a group whose conditional ads together cover
every visit (one mobile-only, one never-mobile), so do not report its groups as
serving only some visits without reading their ads.

Eligible is not serving either: step 4's runtime filters still apply.

## Rule 5 — do not infer a cap from the count

The debug pool runs to 1000, and its size moves with targeting. On a segments-on
zone it is capped instead by the `adFeedCount` of whichever candidate is picked —
the segment's own, or the zone's own when the zone itself is picked — and 1000
when it has none. On a segments zone, check the segments' and the zone's
`adFeedCount` before reading an absence — the offer may just have been cut.
Otherwise a round number is not a cap. Test by varying geo and comparing
membership, not length. The live call is bounded by the zone's (or segment's)
`adFeedCount`, except on a tiering-enabled template.

## Rule 6 — the debug array is not a clean ranking

Entries are broadly score-descending, but ads are placed by slot: forced
positions and the positional exclusions `exceptParams.position`,
`zoneId-position` and `templateId-position` move them (matched as globs; a key
set on the ad group overrides the same key on its ads). Sort by `score` yourself
before presenting a ranking; never read the array top-down and call element 0
the winner. The live call has no scores, so its order is slot order only.

## Reporting

State the network, and for every `get_zone_ads` call whether it was debug or
live, the geo, the device it ran as (none on debug, `desktop` / `other` on live)
and the UTC token — a serving result without its inputs is unreproducible. When
an offer is absent, name the specific constraint (`geo[] excludes OH`,
`dateTimeVisitor excludes thu09`, `params.device requires mobile`) rather than
"missing". Distinguish verified from inferred: if you did not re-run under a
passing condition, say the explanation is unconfirmed.

For the worked example this procedure was derived from, see
[reference.md](reference.md).

## Guardrails
- Pass `network_id` on every call (see Network). A wrong network yields empty or
  foreign results, so state the one you used.
- On `"Error: Not authenticated…"` surface it and ask the user to re-authenticate;
  do not retry. On `"Error: Resource not found…"` the zone or ad group ID is wrong
  — do not invent one. On `"Error: Forbidden…"` the user can't see that resource on the network you used: say which `network_id` you called with and ask whether they meant another network. Do not switch on your own.
- `get_zone_ads` is a read against the live serving path. It is safe to repeat,
  but always send an uppercase state code with debug (Rule 1), in a coherent geo
  set.

## Out of scope
Free radicals, CAG-level leakage, and untargeted groups only a zone default keeps
out (`excludedByDefault`) — use `get_zone_eligible_ad_groups`. Its buckets
describe scoping; each row's `verdict` says whether it serves. Its summary counts
are eligible-only, with conditional rows counted apart (`…Conditional`), so
`freeRadicals` = `freeRadicalHosts + freeRadicalHostsConditional`.
Historical performance — use `report_query` or `get_zone_report`.
