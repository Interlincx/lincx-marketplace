# Zone serving check — reading the output fields

Loaded from `SKILL.md` when a step needs it. Field meanings follow the Lincx MCP's own documentation.

## `explain_serve` with `adId`

With `adId`, the top-level `verdict`, `reasons`, `conditions`, `paramBlocks`,
`matchedKeys`, `contradiction` and `excludedByDefault` are the ad × group
pair's — read the top level; `offer` holds the ad's own rules alone. Read the
path from `via[]` (group) or `offer.scoped_via[]` in the JSON, not from the
header text.

With `adId`, the header also says whether the ad is live, and `offer.live` /
`offer.off` carry it. `live` is the whole chain (campaign, ad group, ad,
creative) whatever the verdict, so an excluded ad can read `live: true`. A
missing `live: true` does not mean off: when a campaign or creative lookup
fails for a reason other than a 404, `offer.liveUnknown` is set, `live` is
`null` unless what was read already shows the ad off, and the header says
"whether the ad is live is unknown (…)". Report that as unknown.

## A NOTE in the header — the zone serves only some visits

If the header carries a **NOTE**, the zone serves only some visits:
`zone.refusesDefaultVisits` (visits keeping the defaults get no ad; only those
overriding `zone.overriddenOnServedVisits` are served),
`zone.servesOnlyPinnedVisits` (only visits naming a `segmentId`), or
`zone.unservedShare` (a share of the visits that don't pin a `segmentId` get no
ad). Lead with that.

`zone.unservedShare` is `{ min, max, atDefaults?, zoneRules[] }`: percent bounds
over unpinned visits, the exact share for visits keeping the defaults when it
is known, and the rules in the zone's own lists. An unserved visit fails at
least one of those rules; a visit passing them all is served. When `min` and
`max` differ, segments whose lists exclude each other can leave the real share
well inside them. On such a zone a 404 from a serving call is not by itself a
finding: that visit may be in the share.

## What a real visit carries

`device` and `deviceOs` from the user agent
(desktop / other when it says nothing); `geoState` from the tag's
`data-geo-state`, else the geo-lookup region code (uppercase, e.g. `TX`), or
`''` when the lookup finds no region — which fails every `geoState` / `geo`
whitelist; a lowercase `params.geoState` rule like `tx` never matches; and the
`dateTime*` keys from the visit's timestamp — `dateTimeUTC` / `dateTimeUS/*`
in their fixed zones, `dateTimeVisitor` in the browser's own offset (not its
geo).

## The live `get_zone_ads` call

**The live call** (`debug` omitted) is a desktop visit (`deviceOs: other`) with
the geo as sent (`''` when none, failing every geo whitelist), the same server
UTC clock, and a fresh visitor (never capped). It returns only the winners — up
to the zone's or picked segment's `adFeedCount`, or all of them on a
tiering-enabled template — as creative payloads with `adId` / `adGroupId`, plus
the `template` and `segmentId` / `segmentName` picked, and **no scores**. Use it
only to confirm what a desktop visitor actually receives, or which segment and
template were picked.

## `get_zone_eligible_ad_groups` — `filter`, `offers.ads[]`, stub rows

To reach the groups behind the `…LiveOnConditionalAds` counts without paging
every row, pass `filter` to `get_zone_eligible_ad_groups`:

- `liveOnlyOnConditionalAds` — eligible, `offers.live === 0`,
  `offers.conditionalLive > 0`: the groups the `…LiveOnConditionalAds` counts name.
- `hasLiveConditionalAd` — `offers.conditionalLive > 0`, mixed groups included.

`page.filter` echoes the filter and `page.total` / `next_offset` count the
filtered rows; `summary` stays whole-zone. `filter` applies within `bucket`, so
`bucket: "directlyTargeted"` with `liveOnlyOnConditionalAds` returns just the
groups `directlyTargetedLiveOnConditionalAds` counts, and `bucket: "freeRadicals"`
just those `freeRadicalHostsLiveOnConditionalAds` counts.

Each row's `offers.ads[]` has one entry per ad, with no cap and no ad skipped:
`{ adId, verdict, live, off?, conditions?, reasons?, paramBlocks?, contradiction?,
contradictionOverridable? }`, empty fields left out. `verdict` is the pair's, the
one the counts use. `conditions`, `reasons` and `paramBlocks` are the ad's own, so
an excluded ad with none of them is out because its group is. `live` is the whole
chain whatever the verdict, so read `verdict` and `live` together before naming an
ad as the one that serves: `conditional` and `live: true` render only on the visits
its `conditions` name. A campaign or creative hidden from the user reads as off
here; `explain_serve` on that ad says the lookup failed instead.

A row too large for one response comes back as a stub, `{ id, name, verdict,
omitted }`, with `complete: false`. It carries no `offers`, so it says nothing
about the group's ads: `explain_serve` gives that group's detail, and `next_offset`
pages on past it.

A `…LiveOnConditionalAds` count can also include a group whose conditional ads together cover
every visit (one mobile-only, one never-mobile), so do not report its groups as
serving only some visits without reading their ads.
