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

## (t1) Update — never in these states, Pacific schedule

**User:** On ad ad0001, never serve in KS or NC, and only Sundays all day Pacific.
**Expected:** `get_ad`, `get_ad_group` (show the group's geoState / time rules next to the ad's: both must pass), read `${CLAUDE_PLUGIN_ROOT}/references/targeting-keys.md`. Current → proposed: `exceptParams.geoState` +KS +NC; `params.dateTimeUS/Pacific` = sun0 … sun23 (24 values), in plain words, live immediately. After "yes": `update_ad({ network_id, id: "ad0001", exceptParams: { geoState: { add: ["KS", "NC"] } }, params: { "dateTimeUS/Pacific": { set: ["sun0", …, "sun23"] } } })`, report `changed`, then `explain_serve({ network_id, zoneId, adId: "ad0001" })`, reading the top-level `verdict` / `conditions` back (group and ad combined; `offer` is the ad's own rules).

## (t2) Update — ad-level zone the group can't reach

**User:** Whitelist zone z00009 on ad ad0001.
**Expected:** `get_ad_group` and `get_zone`: the group whitelists other zones, so z00009 is a hard exclusion. Say an ad can't reach a zone its group can't, and that the group's zones are changed with the `ad-group-editor` skill. No `update_ad`.

## (t3) Update — ad-level zone excluded only on default traffic

The group requires `utm_source=fb` and zone z00010 defaults `utm_source` to `email`, so `get_ad_group_zone_reach` leaves z00010 out. ad0001 has no stored `params.zoneId`.
**User:** Restrict ad ad0001 to zone z00010.
**Expected:** `explain_serve({ network_id, zoneId: "z00010", adGroupId })` shows the group under `excludedByDefault`, which a visit can override. So it is a valid target: propose `params.zoneId` +z00010, saying the ad serves there only on visits that send `utm_source=fb`. After "yes": `update_ad({ network_id, id: "ad0001", params: { zoneId: { add: ["z00010"] } } })`.

## (t4) Update — "restrict to this zone" on an ad that already whitelists zones

ad0001 stores `params.zoneId: ["z00001", "z00002"]`; the group reaches z00003.
**User:** Restrict ad ad0001 to zone z00003.
**Expected:** "restrict to" means the final list is exactly `["z00003"]`. Current → proposed: `params.zoneId` −z00001 −z00002 +z00003, saying the ad stops serving in z00001 and z00002, live immediately. After "yes": `update_ad({ network_id, id: "ad0001", params: { zoneId: { set: ["z00003"] } } })` (or `add` z00003 with `remove` of the two), never a bare `add` that keeps them.

## (t5) Update — an inherited condition comes back cut

The group whitelists 32 states; the user excludes mobile on ad0001.
**Expected:** after the write, `explain_serve` shows the `device` exclusion in full and the group's `geoState` list cut to 20 values with `valuesTotal: 32`. Restate the device rule as the edit made it, and the state list as partial ("32 states, 20 shown") or read in full from `get_ad_group`. Never rebuild the 32 states from the proposal.

## (t6) Update — the ad and its group both target geoState, and a list comes back cut

The group whitelists 32 states. The user sets ad0001's own `geoState` whitelist to 25 of them.
**Expected:** both rules must pass, so the ad serves only in states on both lists. Before the write, show the group's 32 (from `get_ad_group`), the ad's stored rule (from `get_ad`), the 25 the user asked for, and the overlap the ad ends up with. After the write, `explain_serve` returns `geoState` conditions cut to 20 values. Restate the ad's list from the confirmed proposal, labelled as the edited rule, and the group's from `get_ad_group` in full (or as "32 states, 20 shown"). Work out the effective overlap from those full lists, never from a cut condition.
