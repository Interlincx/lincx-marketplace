---
name: zone-editor
description: Use when the user asks to create a Lincx zone, or to rename a zone, change its template or creative asset group (CAG), set or remove its data-attribute defaults, force ads or ad groups into slots (on the zone or one segment), or change its ads-per-render count, explore or experience. Gates create_zone and update_zone behind reads and confirmation.
---

# Lincx — Zone editor

`create_zone` adds a zone to a site. `update_zone` edits a zone's name, template, CAG, data-attribute defaults, forced ads and ad groups, `adFeedCount`, `explore` or experience, and **the edit goes live immediately** — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_zone` or `update_zone` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Create checklist — a hard gate, in order

1. **Resolve the site** with `get_site` (or `list_sites` to find it by name). The zone's publisher and channel come from the site; never ask for them.
2. **Check for a duplicate:** `list_zones({ network_id, siteId, fields: ['id', 'name'] })`, paging until `next_offset` is null. If a zone with the same name exists, show it and ask whether to use it instead.
3. **Pick the template**, if the user wants one: `list_templates({ network_id, publisherId })` with the site's publisher. Its CAG becomes the zone's unless the user names another, and a different one is rejected.
4. **No CAG at all** opens the zone to every untargeted ad group on the network. Do it only when the user says that is intended.
5. **`type`** becomes the case-sensitive `zoneType` targeting key: `Confirmation` or `Landing`, the only values the UI and ad-group targeting offer. Map the user's word to one of them and show it in the proposal; never invent another.
6. **Propose and get explicit confirmation:** site, name, template, CAG, type, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
7. **After the write**, one line with the returned `id`, and say the zone gets no traffic until its tag is on a page.

## Update checklist — a hard gate, in order

1. **Read the zone** with `get_zone`. Never build an edit from memory or from an older read.
2. **Forced ads or ad groups added, moved or removed:** run steps 1–4 of the forced-ads section below first, so the checks come before the proposal.
3. **Show current → proposed** for every field you will send (forced entries in slots), and say it goes live on the zone immediately.
4. **Template or CAG change:** the CAG decides which ad groups can serve. Before the write, take `summary` from `get_zone_eligible_ad_groups({ network_id, zoneId })` and say what it is now.
   - Pick a new template from `list_templates({ network_id, publisherId })` with the zone's publisher. A template from another publisher is refused.
   - To switch the template to one with a different CAG, pass both in one call.
   - On a zone with segments on, the template only covers the zone's own share; each segment renders its own. A CAG change is refused until every segment's template has the new CAG — send the user to the Lincx UI for the segments, don't retry.
5. **`dataAttributesDefault`** merges: a string sets a key, `null` removes it, keys not sent are kept. Each default is what targeting sees on visits that don't send the key, **and** it is written onto every tracked event of the zone. Say both. A refused key is refused for a reason: don't try another spelling of it.
6. **Feed size, explore, experience:** apply the rules under *Other fields* in the forced-ads section. On their own they need no ad and no eligibility check.
7. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
8. **After the write**, report `changed` (only fields whose value changed) and every line of `notes`. After a template or CAG change, read `get_zone_eligible_ad_groups` `summary` again and show before vs after. After a CAG change, also list the `directlyTargeted` rows whose `conflicts` include `whitelisted-cag-mismatch`: they still target the zone on the old CAG and can't serve here. Say so, and leave the targeting change to the user. **Segment ids change on every zone save:** the result names the new ids. Re-read with `get_zone` before any further segment edit; never reuse an old id.

## Forced ads and ad groups

A forced entry pins an ad, or the best ad of an ad group, to a **slot**. Slots are 1-based, like the UI: slot 1 is the first ad. `get_zone` stores them 0-based (`forcedAdPositions`, `forcedAdGroups[].position`), so add 1 when you show the stored config and never send a stored position as a slot. These steps run inside the Update checklist (its step 2): they come back to it for the proposal, the confirmation and the write.

1. **Read the zone's forced config** from the `get_zone` result and show what applies where, in slots:
   - **No CAG:** a zone without a `creativeAssetGroupId` can't use forced ads (the API refuses). Say so and don't propose.
   - **Where it applies:** the zone's own config, plus each segment's. A segment with **any** forced config, even an empty `{}`, replaces the zone's entire config on its visits. Forcing only ad groups on a segment also drops the zone's forced ads there. A segment with none inherits the zone's. Say which applies before proposing.
   - **Segments off:** a segment's config only applies once segments are on.
2. **Pick the target** for each entry you add or move:
   - `forcedAds` `{ adId: slot }` pins one ad; `null` unforces that ad.
   - `forcedAdGroups` `{ adGroupId: slot }` pins the ad group's best ad; `null` unforces that ad group. Both merge: ids you don't send are kept.
   - `forcedAdGroupParams` `[{ params, slot }]` pins the best ad whose ad group or ad has `params[k]` including the value. It **replaces** every params entry: to add one, resend the stored ones too (as slots, stored position + 1). `null` clears them all; `[]` is rejected.
   - **One segment:** pass `segmentId` to edit that segment instead of the zone. `segmentId` scopes only the forced fields and `adFeedCount`.
3. **Check the target can fill the slot**, for each entry you add or move. A removal (`null`) needs no check. Forcing never bypasses targeting: when the ad doesn't serve on a visit, the organic ads fill its slot. Run `explain_serve({ network_id, zoneId, adId })` (or `adGroupId`) and branch on `verdict`, never on `eligible`, which is false for conditional results too:
   - **`eligible`:** it fills the slot on every visit that keeps the zone's defaults. If the header says it holds only while a visit leaves a key at its zone default, say so.
   - **`conditional`:** it fills the slot only on visits matching `conditions[]`; name them. On other visits the organic ads fill it. This is not a rejection.
   - **`excluded`:** it never fills the slot. Name the `reasons[]`. With `excludedByDefault`, say that a visit overriding that zone default would change this. Ask whether to go ahead anyway.
   - **With `segmentId`:** if `conditions[]` has an entry with `source: 'segment'`, read the edited segment's `candidates[].passes`. `false` means it never fills the slot on that segment's visits.
   - **With an `adId`:** also report `offer.live`. `false`: it won't fill the slot until it is switched on (`offer.off` says what is off). `null` (`liveUnknown`): say whether it is live is unknown.
   - **With an `adGroupId`:** the verdict covers the group's own rules only, not its ads or whether they are live. Also read that group's row in `get_zone_eligible_ad_groups({ network_id, zoneId })` and branch on its `offers`:
     - `offers.live` > 0: a live ad of the group fills the slot on every visit that keeps the zone's defaults.
     - `offers.live` 0 and `offers.conditionalLive` > 0: its live ads are conditional. It fills the slot on the visits their `offers.ads[]` conditions match (several conditional ads together can cover every visit); name them. Other visits go to organic ads.
     - both 0: no live ad of the group serves here, so organic ads fill the slot. Say which `offers.ads[]` are off or excluded.
   - **A params entry** has no id to check: say a slot forced by params can't be checked in advance.
4. **Check the slots:** mention a slot past `adFeedCount` (an ad there may never render). Then return to the Update checklist at step 3.
5. **Other fields** (on their own, or alongside forced entries):
   - `adFeedCount` is ads per render. With `segmentId` it is the segment's; `null` there makes it inherit the zone's.
   - `explore` is the score exploration factor (≥ 0); `null` clears it.
   - `experienceId` must be an experience on the zone's site (`list_experiences({ network_id, siteId })`); `null` clears it.
   - `explore` and `experienceId` always apply to the zone, even in a call with `segmentId`. A call with `segmentId` must also carry a forced field or `adFeedCount`; with neither, it is refused.

Refusals:
- **"slot N already holds forced ad X":** two ads can't share a slot. Ask whether to move X or unforce it in the same call.
- **"slot N would hold 2 forced ad-group entries":** two ad-group entries (by id or params) can't share a slot either. Ask which one to move or unforce in the same call.
- **"Zone should have creativeAssetGroupId to use Forced Ads":** the zone has no CAG. Report it; step 1 should have caught this.
- **"assigned to different slot than Forced Ad Group" / "creativeAssetGroupId doesn't match":** report it. An ad and its own ad group must share a slot, and a forced ad or group must be on the zone's CAG. The `#N` in these messages is the stored 0-based position: say slot N+1.
- **A refusal naming an entry the edit didn't touch:** the API rechecks the whole zone and every segment on each save, so a stale forced entry elsewhere (for example on an old CAG) blocks the edit. Show it and ask whether to unforce it in the same call.
- **"has no segment":** the id is stale. Re-read the zone.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_zones` with `siteId` for a create, `get_zone` for an update) before anything else. Never retry blind — a create retry makes a duplicate.
- **The stored defaults, forced config or segments changed since the read:** someone else edited the zone. Re-read with `get_zone`, re-propose, and confirm again.
- **"Nothing to change":** the zone already holds those values. Say so; no write happened.
- **A refusal naming a site, template or CAG** (missing, archived, another network): report it. Don't swap in a different entity without asking.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Offer to change what the tools can't: site, publisher, channel, network, `type` after create, segment structure (status, add/remove, allocation, template, lists, persona), allow/blocklists, scoring override, postback pixels, test templates. Point the user to the Lincx UI.
- Bundle a write with an unrelated question, or edit several zones from one confirmation the user didn't give for each.
- Pick a network for the user.
