# Golden — ad group editor

Expected behaviour of the `ad-group-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — targeted, happy path

**User:** Create ad group "Auto Quotes" in campaign cmp001 on CAG cag001, targeting zones z00001 and z00002.
**Expected:**
1. `get_campaign`, `list_creative_asset_groups` (or the zones' CAG), `get_zone` for both, `list_ad_groups` with campaignId (no duplicate).
2. A proposal (campaign, name, CAG, whitelist 2 zones, no blacklist, enabled), then stop.
3. After "yes": `create_ad_group({ network_id, campaignId: "cmp001", name: "Auto Quotes", creativeAssetGroupId: "cag001", zoneIds: ["z00001", "z00002"] })`, then the id and counts.

## (b) Create — no zones named

**User:** Create ad group "Everything" in cmp001 on cag001.
**Expected:** say it would be a free radical — open in every zone on cag001 and every zone with no CAG — and ask which zones, or whether that is intended. Offer `enabled: false`. No `create_ad_group` until the user answers. On "stage it": `create_ad_group({ network_id, campaignId: "cmp001", name: "Everything", creativeAssetGroupId: "cag001", enabled: false })` (no `allowUntargeted` needed). Only on "yes, open everywhere": `create_ad_group({ network_id, campaignId: "cmp001", name: "Everything", creativeAssetGroupId: "cag001", allowUntargeted: true })`, then repeat the WARNING word for word.

## (c) Create — zone on another CAG

z00003 is on cag009.
**Expected:** say the group could never serve there, before any write. If the tool refuses it anyway, report the refusal; don't drop the zone silently.

## (d) Update — add and remove zones

**User:** On grp001, add z00004 and drop z00001.
**Expected:** `get_ad_group`, `get_ad_group_zone_reach` summary, `get_zone` for z00004. Current → proposed: whitelist +z00004 −z00001, live immediately. After "yes": `update_ad_group({ network_id, id: "grp001", addZoneIds: ["z00004"], removeZoneIds: ["z00001"] })`, report `changed`, reach summary before vs after.

## (e) Update — removing the last zone

grp001 targets only z00001. **User:** Remove z00001 from grp001.
**Expected:** say this makes it a free radical, and ask whether that is intended or whether to switch it off instead. Only on an explicit "yes, untargeted": `update_ad_group({ network_id, id: "grp001", removeZoneIds: ["z00001"], allowUntargeted: true })`.

## (f) Update — concurrent edit

`update_ad_group` returns "zone lists changed since they were read — nothing was written".
**Expected:** `get_ad_group` again, re-propose against the new lists, confirm again. No blind retry.

## (g) Update — switch on an untargeted group

grp003 is disabled and targets no zone. **User:** Turn on grp003.
**Expected:** `get_ad_group`, `get_ad_group_zone_reach`; say switching it on makes it a free radical — open in every zone on its CAG and every zone with no CAG — and ask whether that is intended or which zones to add. If the user names zones: `update_ad_group({ network_id, id: "grp003", enabled: true, addZoneIds: ["z00004"] })`. Only after "yes, open": `update_ad_group({ network_id, id: "grp003", enabled: true, allowUntargeted: true })`, then repeat the result's WARNING word for word.

## (h) Zones unreadable

`create_ad_group` returns "could not read the network's zones to check the zone ids".
**Expected:** say the zones couldn't be checked and nothing was written; offer to retry. Never retry without the zones.

## (t1) Update — states and a schedule

grp001 has no stored `geoState` or time key.
**User:** On grp001, only serve TX and OK, weekdays 9am–5pm Eastern.
**Expected:** (if it had stored `geoState: ["CA"]`, "only" means removing CA too, or a `set` of TX, OK.) `get_ad_group`, read `${CLAUDE_PLUGIN_ROOT}/references/targeting-keys.md`, `get_ad_group_zone_reach` summary. Current → proposed: `params.geoState` +TX +OK; `params.dateTimeUS/Eastern` = Mon–Fri 9–16 (40 values), in plain words "only visits from TX or OK, Monday–Friday 9:00–17:00 Eastern", live immediately. After "yes": `update_ad_group({ network_id, id: "grp001", params: { geoState: { add: ["TX", "OK"] }, "dateTimeUS/Eastern": { set: ["mon9", …, "fri16"] } } })`, report `changed`, reach summary before vs after, then `explain_serve` for one zone, reading its `conditions` back as the rule working.

## (t2) Update — block slots 2–4 everywhere

**User:** Keep grp001 out of slots 2 to 4 in every zone.
**Expected:** proposal `exceptParams.zoneId-position` +`*-2` +`*-3` +`*-4`, never in `params`. After "yes": `update_ad_group({ network_id, id: "grp001", exceptParams: { "zoneId-position": { add: ["*-2", "*-3", "*-4"] } } })`.

## (t3) Update — a client key the network has never seen

**User:** Only serve grp001 when utm_sorce is fb.
**Expected:** check `get_event_stats_keys`; `utm_sorce` is not there but `utm_source` is. Ask whether they meant `utm_source`. No `allowNewKeys` unless the user says the key is new. If the tool refuses with "is not a Lincx targeting key", report it the same way.

## (t4) Update — lowercase state

The tool returns "targeting problem … two-letter UPPERCASE".
**Expected:** say nothing was written, propose `TX` instead of `tx`, and confirm again before resending.

## (t5) Update — a client key only a zone default supplies

Zone z00001, which grp001 whitelists, has `dataAttributesDefault: { s1: "abc" }`; no traffic yet, so `get_event_stats_keys` has no `s1`.
**User:** Only serve grp001 when s1 is abc.
**Expected:** `get_zone` shows the default, which counts as the key's source. Propose `params.s1` +abc, naming z00001 as the zone that supplies it, and say other zones only match on visits that send `s1=abc`. After "yes": `update_ad_group({ network_id, id: "grp001", params: { s1: { add: ["abc"] } }, allowNewKeys: true })`.

## (t6) Update — blacklisting a client key

**User:** Never serve grp001 when utm_source is partner. `utm_source` is in `get_event_stats_keys`, and no zone sets a default for it.
**Expected:** propose `exceptParams.utm_source` +partner. After "yes" and the write, `explain_serve` reads CONDITIONAL with an `excludes` condition. Report it as "blocked when the visit sends utm_source=partner; visits without it are not blocked by this rule" (the group's other rules still apply). It is not a delivery failure, and no source needs confirming.

## (t7) Update — a zone default on a zone the group can't reach

grp001 whitelists only z00001, which has no `s1` default. z00002 has `dataAttributesDefault: { s1: "abc" }` but isn't in the group's whitelist.
**User:** Only serve grp001 when s1 is abc.
**Expected:** z00002's default proves `s1` exists, not that grp001's traffic carries it, since grp001 can't reach z00002. Ask whether the tag on z00001 sends `s1=abc`. If the user can't confirm, say before asking for confirmation that no matching traffic is verified and grp001 may stop serving. No `allowNewKeys` on z00002's default alone.
