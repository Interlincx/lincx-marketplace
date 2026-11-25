---
name: ad-editor
description: Use when the user asks to create a Lincx ad (place a creative in an ad group), or to rename an ad, switch it on or off, swap its creative, or set or remove its cpc or cpa.
---

# Lincx — Ad editor

`create_ad` places one creative in one ad group. `update_ad` edits an ad's name, on/off state, creative, `cpc` or `cpa`. **An enabled ad under an enabled ad group and campaign serves at once**, and every edit goes live immediately wherever the ad serves — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_ad` or `update_ad` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Prices are money

- `cpc` is the cost per click. `cpa` is a fixed value applied to a conversion whose postback arrives without a price.
- Use the exact number the user gave. Never infer, round, convert or carry a price over from another ad. If the user didn't give one, leave it out and say so; don't ask leading questions that suggest a value.
- Repeat every price back in the proposal, with its unit, before the write.
- Both must be greater than 0. The tools refuse a value above a sanity cap (cpc 1000, cpa 10000) as a likely typo — if the user confirms a real value above it, send them to the Lincx UI.

## Create checklist — a hard gate, in order

1. **Read the ad group** with `get_ad_group`, and its campaign with `get_campaign` (the group's `campaignId`). The campaign and advertiser come from the group; never ask for them. Say if either is switched off (or the campaign is outside its dates): an enabled ad then does not serve until both are on.
2. **Pick the creative:** `list_creatives({ network_id, advertiserId })` with the group's advertiser. It must be on the group's creative asset group (CAG); one on another CAG is refused.
3. **Where it will serve:** `get_ad_group_zone_reach({ network_id, adGroupId })`. If the group targets no zone it is a free radical — this ad would serve in every zone on its CAG and every zone with no CAG. Say so.
4. **Check for a duplicate:** `list_ads({ network_id, adGroupId, fields: ['id', 'name', 'creativeId'] })`, paging until `next_offset` is null. Same name or same creative already in the group: show it and ask.
5. **`enabled`** defaults to true, as in the Lincx UI: the ad serves as soon as it is created if the group and campaign are on. Offer `enabled: false` to stage it.
6. **Propose and get explicit confirmation:** network, ad group, creative, name, enabled, every price, and where it will serve. Then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
7. **After the write**, one line with the returned `id`, and repeat any WARNING or note the result carries (for example that the ad group is switched off).

## Update checklist — a hard gate, in order

1. **Read the ad** with `get_ad`. Never build an edit from memory or from an older read.
2. **New creative?** `get_ad_group` with the ad's `adGroupId` for its CAG, then `list_creatives({ network_id, advertiserId })` with the ad's advertiser; pick one on that CAG. It changes what the ad renders everywhere it serves — unless `get_ad` shows `testCreativesStatus: 'on'`: then every serve renders one of `testCreatives` instead, so say the swap won't change what renders and name the test creatives (editing them is a Lincx UI job).
3. **Switching it on, or swapping the creative of an enabled ad?** `get_ad_group_zone_reach({ network_id, adGroupId })` with the ad's `adGroupId`, and say where it will serve. If the group targets no zone it is a free radical — every zone on its CAG and every zone with no CAG.
4. **Switching it off, or editing an ad that is already off?** If the ad has `minTrafficAllocation`, say the API drops it on any write to a disabled ad, and it is usually dropped for good.
5. **Show current → proposed** for every field you will send, prices with their unit, and say it goes live immediately. `null` removes a price.
6. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
7. **After the write**, report `changed`. After an on/off change, `explain_serve({ network_id, zoneId, adId })` shows whether the ad is live in a given zone.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_ads` with `adGroupId` for a create, `get_ad` for an edit) before anything else. Never retry blind — a create retry makes a duplicate.
- **"did not apply …"**: the API accepted the call but kept the old value. Re-read with `get_ad`; don't retry the same edit.
- **"changed since it was read"**: someone else edited the ad. Nothing was written. Re-read with `get_ad`, re-propose, and confirm again.
- **A WARNING that the ad group targets no zone**: the ad serves (or will, once the group is switched on) in every zone on its CAG and every zone with no CAG. Repeat it word for word; if the user didn't ask for that, suggest switching the ad off or adding zones to the group (`ad-group-editor` skill).
- **"Test creatives are on"**: the swap landed but changes nothing visible. Repeat which test creatives render; changing them is a Lincx UI job.
- **"minTrafficAllocation … was dropped"**: repeat the value; it is set again in the Lincx UI.
- **A creative refused** (another CAG, another advertiser, archived — "pick another creative"): report it and pick again with the user. Never swap in a creative they didn't choose.
- **"Sum of ads traffic allocations within AdGroup should be equal or lower than 100%"** (update only — `create_ad` never sends an allocation): the edited ad is enabled and has its own `minTrafficAllocation`, and with the group's other enabled ads the total would go over 100%. Report it; allocations are changed in the Lincx UI.
- **"belongs to network …" / "is not in network …" / "is archived" / "not found"** (the ad, its group or the creative): report it. Don't swap in another entity without asking.
- **Forbidden**: the user can't write ads in this ad group or network. Say so; don't retry.
- **"Nothing to change"**: the ad already holds those values. Say so; no write happened.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Invent, round or reuse a price the user didn't give for this ad.
- Create or switch on an ad without saying where it will serve.
- Offer to change what the tools can't: moving an ad to another ad group, cpmOverride, boost, ad-level targeting, limits, postback pixels, test creatives, traffic allocation, archive. Point the user to the Lincx UI.
- Bundle several writes, or several ads, into one confirmation.
- Pick a network for the user.
