# Golden — ad editor

Expected behaviour of the `ad-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — happy path with a price

**User:** Add creative cre001 to ad group grp001 as "Quote Ad", $1.25 per click.
**Expected:**
1. `get_ad_group`, `list_creatives` with the group's advertiser (cre001 on the group's CAG), `get_ad_group_zone_reach`, `list_ads` with adGroupId (no duplicate).
2. A proposal: group, creative, name, enabled, cpc 1.25 per click, and the zones it will serve in. Then stop.
3. After "yes": `create_ad({ network_id, adGroupId: "grp001", creativeId: "cre001", name: "Quote Ad", cpc: 1.25 })`.

## (b) Create — no price given

**User:** Add cre001 to grp001.
**Expected:** propose without cpc/cpa and say none is set. Never fill in a price from another ad.

## (c) Create — untargeted group

grp002 targets no zone.
**Expected:** say this ad would serve in every zone on the group's CAG and every zone with no CAG; offer `enabled: false`. Write only on explicit confirmation.

## (d) Update — swap the creative

**User:** Show cre009 instead on ad ad0001.
cre009 is on another CAG.
**Expected:** `get_ad`, then `get_ad_group` with its adGroupId for the group's CAG; say cre009 can't be used (another CAG) and pick again with the user. No `update_ad` with cre009.

## (e) Update — switch off an ad with minTrafficAllocation

ad0001 has `minTrafficAllocation: 20`. **User:** Turn off ad0001.
**Expected:** `get_ad`, say the 20% allocation is dropped by the API and usually for good. After "yes": `update_ad({ network_id, id: "ad0001", enabled: false })`, report `changed`.

## (f) Update — remove a price

**User:** Remove the cpa on ad0001.
**Expected:** `get_ad`, current → proposed (cpa 40 → none). After "yes": `update_ad({ network_id, id: "ad0001", cpa: null })`.

## (g) Update — switch on an ad in an untargeted group

ad0002 is off; its group grp002 targets no zone. **User:** Turn on ad0002.
**Expected:** `get_ad`, `get_ad_group_zone_reach` for grp002 — say the ad would serve in every zone on the group's CAG and every zone with no CAG. Only after "yes": `update_ad({ network_id, id: "ad0002", enabled: true })`.

## (h) Update — swap the creative under test creatives

ad0003 has `testCreativesStatus: "on"` with test creative cre777 at 100%. **User:** Use cre002 on ad0003.
**Expected:** `get_ad`; say every serve renders cre777, so the swap won't change what renders, and that test creatives are edited in the Lincx UI. Only on "yes, swap anyway": `update_ad({ network_id, id: "ad0003", creativeId: "cre002" })`, then repeat the result's test-creatives note.

## (i) Update — concurrent edit

`update_ad` returns "ad ad0001 changed since it was read — nothing was written".
**Expected:** `get_ad` again, re-propose against what it now holds, confirm again. No blind retry.
