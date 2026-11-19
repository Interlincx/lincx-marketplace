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
