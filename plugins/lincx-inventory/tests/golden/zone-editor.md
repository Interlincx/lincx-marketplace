# Golden — zone editor

Expected behaviour of the `zone-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — duplicate name on the site

**User:** Create a zone "Sidebar" on site sit001.
`list_zones({ network_id, siteId: "sit001" })` returns a zone named "Sidebar".
**Expected:** show the existing zone and ask whether to use it. No `create_zone`.

## (b) Create — happy path

**User:** Create "Footer" on sit001 with template tpl001.
**Expected:**
1. `get_site`, `list_zones` (no duplicate), `list_templates` with the site's publisher.
2. A proposal (site, name, template, the template's CAG, no type), then stop.
3. After "yes": `create_zone({ network_id, siteId, name, templateId })`, then one line with the id and that the zone gets no traffic until its tag is placed.

## (c) Create — timeout

`create_zone` returns "timed out — the zone MAY have been created".
**Expected:** `list_zones` with siteId, look for "Footer". No second `create_zone` unless it's absent and the user confirms again.

## (d) Update — CAG change

**User:** Switch zone z00001 to CAG cag002.
**Expected:**
1. `get_zone`, current → proposed (`creativeAssetGroupId` cag001 → cag002), "goes live immediately".
2. `get_zone_eligible_ad_groups` summary now. If the zone's template has CAG cag001, say a template with cag002 is needed too: both in one call.
3. After "yes": `update_zone`, report `changed`, eligibility summary again, before vs after.

## (e) Update — segments refuse the CAG change

`update_zone` refuses: a segment's template has another CAG.
**Expected:** report it, send the user to the Lincx UI for the segments. No retry, no other template swapped in.

## (f) Update — defaults

**User:** Set default `s1` to `abc` on z00001 and remove `s2`.
**Expected:** `get_zone`, show the stored map before and after, say a default is both a targeting value and written onto every tracked event. After "yes": `update_zone({ network_id, id, dataAttributesDefault: { s1: "abc", s2: null } })`.

## (g) Update — refused key

**User:** Set default `geoState` to `TX` on z00001.
`update_zone` refuses `geoState`.
**Expected:** report why (a default would overwrite the per-visit value in reporting). No retry with `geostate` or another spelling.

## (h) Update — force an ad into slot 1

**User:** Force ad ad0001 into the first position on z00001.
**Expected:**
1. `get_zone`. Show the stored forced config in slots (stored position + 1), and say whether segments override it.
2. `explain_serve({ network_id, zoneId: "z00001", adId: "ad0001" })`, branching on `verdict`: `excluded` → name `reasons[]`, say the slot won't hold it, ask whether to go ahead; `conditional` → name the visits it fills the slot on; also report `offer.live`.
3. Current → proposed: `ad0001` → slot 1, "goes live immediately". Then stop.
4. After "yes": `update_zone({ network_id, id: "z00001", forcedAds: { ad0001: 1 } })` — slot 1, never position 0. Report `changed` and every `notes` line.

## (i) Update — slot already taken

`update_zone` refuses: "slot 1 already holds forced ad ad0002".
**Expected:** ask whether to move ad0002 (to which slot) or unforce it (`null`) in the same call. No retry with ad0001 alone.

## (j) Update — one segment's forced ad groups

**User:** On z00001, force ad group grp001 into slot 2 for segment seg001 only.
**Expected:**
1. `get_zone`. Say that if seg001 had no forced config before, it now stops inheriting the zone's forced ads and ad groups on its visits.
2. `explain_serve({ network_id, zoneId: "z00001", adGroupId: "grp001" })`, branching on `verdict` (with a `source: 'segment'` condition, seg001's `candidates[].passes`), and grp001's row in `get_zone_eligible_ad_groups`, branching on `offers.live` / `offers.conditionalLive` (see (p)).
3. Current → proposed for seg001 in slots (grp001 → slot 2), "goes live immediately". Then stop.
4. After "yes": `update_zone({ network_id, id: "z00001", segmentId: "seg001", forcedAdGroups: { grp001: 2 } })`.
5. The result names new segment ids: use them, and `get_zone` again before any further segment edit.

## (k) Update — conditional forced ad

`explain_serve` for ad0003 returns `verdict: "conditional"`, `conditions: [{ key: "geoState", op: "requires", values: ["TX"] }]`.
**Expected:** say ad0003 fills the slot on Texas visits only and the organic ads fill it otherwise. Not a rejection: propose the edit without warning that the slot will never hold it.

## (l) Update — feed size only

**User:** Show 5 ads per render on z00001.
**Expected:** `get_zone`, current → proposed `adFeedCount`, then stop. No ad target and no `explain_serve`. After "yes": `update_zone({ network_id, id: "z00001", adFeedCount: 5 })`; report `changed` and any `notes` line (a forced slot past the new count).

## (m) Update — unforce an ad

**User:** Stop forcing ad0001 on z00001.
**Expected:** `get_zone`, current → proposed (ad0001 slot 1 → removed). No `explain_serve` for a removal. After "yes": `update_zone({ network_id, id: "z00001", forcedAds: { ad0001: null } })`.

## (n) Update — zone with no CAG

**User:** Force ad ad0001 into slot 1 on z00002, which has no `creativeAssetGroupId`.
**Expected:** `get_zone`, then say a zone without a CAG can't use forced ads. No `explain_serve`, no proposal, no `update_zone`.

## (o) Update — upstream slot number

`update_zone` refuses: "Forced Ad (ad0001/#0) assigned to different slot than Forced Ad Group (grp001/#2)".
**Expected:** report it in slots: ad0001 is in slot 1 and its ad group grp001 in slot 3; they must share one. Ask which slot to use. No retry.

## (p) Update — forced ad group with only conditional live ads

grp002's row in `get_zone_eligible_ad_groups` has `offers.live: 0`, `offers.conditionalLive: 1`, and its one live ad requires `geoState` TX.
**Expected:** say grp002 fills the slot on Texas visits and organic ads fill it otherwise. Not "no live ad serves here": that is only for `offers.live` and `offers.conditionalLive` both 0.
