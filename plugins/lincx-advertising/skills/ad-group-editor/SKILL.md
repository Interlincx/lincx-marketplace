---
name: ad-group-editor
description: Use when the user asks to create a Lincx ad group, or to rename one, switch it on or off, or add or remove zones in its targeting (whitelist or blacklist).
---

# Lincx — Ad group editor

`create_ad_group` adds an ad group under a campaign. `update_ad_group` renames one, switches it on or off, or adds and removes zones in its whitelist (`params.zoneId`) and blacklist (`exceptParams.zoneId`). **Every edit goes live immediately in every zone it touches** — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_ad_group` or `update_ad_group` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## How an ad group reaches a zone

- **Creative asset group (CAG).** A zone serves only ad groups on its own CAG; a zone with no CAG skips that filter. A whitelisted zone on another CAG is dead config — the group can never serve there, and the tools refuse it.
- **Whitelist (`zoneIds`).** The zones the group targets.
- **Blacklist (`exceptZoneIds`).** Zones the group never serves in. It always wins over the whitelist; a zone can't be in both.
- **No whitelist at all = a "free radical":** the group is open in **every** zone on its CAG and every zone with no CAG. Never leave a group untargeted unless the user says that is intended, in so many words.
- Ads added later must use creatives on the group's CAG. The CAG can't be changed once the group has ads.

## Create checklist — a hard gate, in order

1. **Resolve the campaign** with `get_campaign` (or `list_campaigns`). The advertiser comes from it; never ask for it. Say if the campaign is switched off or outside its dates — nothing in it serves until that changes.
2. **Pick the CAG:** `list_creative_asset_groups({ network_id })`, or the CAG of the zones the user wants. It must match the creatives the ads will use.
3. **Pick the zones:** `get_zone` for each one the user named (or `list_zones` to find them). Each whitelisted zone must be on the group's CAG or have none.
4. **Check for a duplicate:** `list_ad_groups({ network_id, campaignId, fields: ['id', 'name'] })`, paging until `next_offset` is null. If one has the same name, show it and ask whether to use it instead.
5. **No zones?** Say it makes a free radical and what that means, and offer `enabled: false` to stage it. An enabled group with no zones is refused unless `allowUntargeted: true`: pass it only when the user confirms an open group is intended, in so many words.
6. **`enabled`** defaults to true, as in the Lincx UI: the group serves as soon as it has a live ad under a live campaign.
7. **Propose and get explicit confirmation:** network, campaign, name, CAG, whitelist, blacklist, enabled, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
8. **After the write**, one line with the returned `id` and the zone counts. Repeat any WARNING the result carries. If the user is building a new setup, the next step is an ad (the `ad-editor` skill, if it is installed).

## Update checklist — a hard gate, in order

1. **Read the group** with `get_ad_group`. Never build an edit from memory or from an older read. Its zone lists can be very long: name only the zones being added or removed, never echo the whole list.
2. **Where it serves now:** `get_ad_group_zone_reach({ network_id, adGroupId })` — keep `summary` for the before/after.
3. **For each zone to add:** `get_zone` — on the group's CAG or none (whitelist), not archived. For a single zone's question, `explain_serve({ network_id, zoneId, adGroupId })`.
4. **Show current → proposed:** name, enabled, and the zone ids added to and removed from each list. Say it goes live immediately in those zones. **If the group will be enabled with no whitelisted zone** — switching on a group that has none, or keeping one enabled — it is a free radical: open in every zone on its CAG and every zone with no CAG. Say so and ask which zones to add (`addZoneIds` in the same call), or whether an open group is intended. Switching on a group with none is refused unless `allowUntargeted: true`.
5. **Removing the last whitelisted zone** turns the group into a free radical too. For both, the tool refuses unless `allowUntargeted: true`; pass it only when the user asked for exactly that.
6. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
7. **After the write**, report `changed`, repeat any WARNING the result carries, then `get_ad_group_zone_reach` `summary` again: before vs after.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_ad_groups` with `campaignId` for a create, `get_ad_group` for an edit) before anything else. Never retry blind — a create retry makes a duplicate.
- **"zone lists changed since they were read"** or **"changed since it was read"**: someone else edited the group (this also covers a zone they added at the same moment — the API's "duplicate items" refusal). Nothing was written. Re-read with `get_ad_group`, re-propose, and confirm again.
- **"could not read the network's zones"**: the zone ids couldn't be checked, so nothing was written. Say so; retry once the user agrees, never by dropping the zones.
- **"does not show … applied"**: the API answered but the change isn't visible. Re-read with `get_ad_group`; don't retry the same edit.
- **A zone refused** (another CAG, archived, not in the network, in both lists): report each one. Don't swap in other zones without asking.
- **"makes it a free radical"** / **"is a free radical"** (create, enable or remove-last): say what that means and ask which zones to add; never add `allowUntargeted` on your own.
- **"Campaign … is switched off" / "outside its flight window"**: the write landed, but nothing in the campaign serves yet. Say so; changing the campaign is the `campaign-editor` skill.
- **A WARNING that the group targets no zone**: it is enabled and open in every zone on its CAG. Repeat it word for word; if the user didn't ask for that, suggest turning it off or adding zones.
- **"belongs to network …" / "is not in network …" / "is archived" / "not found"** (the campaign, CAG or group): report it. Don't swap in another entity without asking.
- **Forbidden**: the user can't write ad groups in this campaign or network. Say so; don't retry.
- **"Nothing to change"**: the group already holds those values. Say so; no write happened.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Create or leave a group with no whitelisted zone unless the user said that is intended.
- Pass `allowUntargeted` without the user asking for an untargeted group.
- Offer to change what the tools can't: the CAG, campaign or advertiser, other targeting keys (geo, device, time, data attributes), limits, frequency capping, archive. Point the user to the Lincx UI.
- Bundle several writes, or several ad groups, into one confirmation.
- Pick a network for the user.
