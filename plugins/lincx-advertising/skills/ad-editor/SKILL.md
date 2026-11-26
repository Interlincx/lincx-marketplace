---
name: ad-editor
description: Use when the user asks to create a Lincx ad (place a creative in an ad group), or to rename an ad, switch it on or off, swap its creative, set or remove its cpc or cpa, or change its targeting — zones, states, devices, OS, time of day, blocked slots, client keys. Gates create_ad and update_ad behind reads and confirmation.
---

# Lincx — Ad editor

`create_ad` places one creative in one ad group. `update_ad` edits an ad's name, on/off state, creative, `cpc`, `cpa`, or its targeting (`params` / `exceptParams`). **An enabled ad under an enabled ad group and campaign serves at once**, and every edit goes live immediately wherever the ad serves — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

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

## Ad-level targeting

Before building any `params` / `exceptParams` edit, read `${CLAUDE_PLUGIN_ROOT}/references/targeting-keys.md`. It covers the keys, value formats, time-of-day expansion, slot blocks and the traps. Ad rules run **after** the ad group's: they pick which of the group's ads serve on a visit the group already accepted, so an ad can never reach a zone or visit its group refuses. `create_ad` takes no targeting. Set it with `update_ad` once the ad exists: offer to create it with `enabled: false`, add the targeting, then switch it on. If `update_ad` has no `params` input in your tool list, the Lincx MCP doesn't support targeting edits yet (Interlincx/lincx-mcp#197): say so and point the user to the Lincx UI.

## Create checklist — a hard gate, in order

1. **Read the ad group** with `get_ad_group`, and its campaign with `get_campaign` (the group's `campaignId`). The campaign and advertiser come from the group; never ask for them. Say if either is switched off (or the campaign is outside its dates): an enabled ad then does not serve until both are on.
2. **Pick the creative:** `list_creatives({ network_id, advertiserId })` with the group's advertiser. It must be on the group's creative asset group (CAG); one on another CAG is refused.
3. **Where it will serve:** `get_ad_group_zone_reach({ network_id, adGroupId })`. If the group targets no zone it is a free radical — this ad would serve in every zone on its CAG and every zone with no CAG. Say so. (A new ad carries no zone whitelist of its own; `update_ad` can add one.)
4. **Check for a duplicate:** `list_ads({ network_id, adGroupId, fields: ['id', 'name', 'creativeId'] })`, paging until `next_offset` is null. Same name or same creative already in the group: show it and ask.
5. **`enabled`** defaults to true, as in the Lincx UI: the ad serves as soon as it is created if the group and campaign are on. Offer `enabled: false` to stage it.
6. **Propose and get explicit confirmation:** network, ad group, creative, name, enabled, every price, and where it will serve. Then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
7. **After the write**, one line with the returned `id`, and repeat any WARNING or note the result carries (for example that the ad group is switched off).

## Update checklist — a hard gate, in order

1. **Read the ad** with `get_ad`. Never build an edit from memory or from an older read.
2. **New creative?** `get_ad_group` with the ad's `adGroupId` for its CAG, then `list_creatives({ network_id, advertiserId })` with the ad's advertiser; pick one on that CAG. It changes what the ad renders everywhere it serves — unless `get_ad` shows `testCreativesStatus: 'on'`: then every serve renders one of `testCreatives` instead, so say the swap won't change what renders and name the test creatives (editing them is a Lincx UI job).
3. **Switching it on, or swapping the creative of an enabled ad?** `get_ad_group_zone_reach({ network_id, adGroupId })` with the ad's `adGroupId`, and say where it will serve. If the group targets no zone it is a free radical — every zone on its CAG and every zone with no CAG — unless the ad has its own `params.zoneId`: then only those zones.
4. **Switching it off, or editing an ad that is already off?** If the ad has `minTrafficAllocation`, say the API drops it on any write to a disabled ad, and it is usually dropped for good.
5. **Targeting?** Follow `${CLAUDE_PLUGIN_ROOT}/references/targeting-keys.md`. Read the ad's group too (`get_ad_group`): show the group's rule for the same key next to the ad's, since both must pass. A zone in the ad's `params.zoneId` must be one the group can reach. The hard limits are the group's own zone lists (whitelist, blacklist) and its creative asset group, so check them with `get_ad_group` and `get_zone`. A zone missing from `get_ad_group_zone_reach` only because of a zone default can still be reached by visits that override it. Check it with `explain_serve({ network_id, zoneId, adGroupId })`: an overridable default (`excludedByDefault`) is a valid target, and the proposal names the visit condition. Use `add` / `remove` for changes and `set` only to replace a list on purpose. Check a client key against `get_event_stats_keys({ network_id })`; the reference lists the few request keys it never reports. Event fields such as `siteId` are not request keys: to target one site, channel or experience exactly, use its zones (`zoneId`). `channelType` is a category that takes in every zone whose channel shares the type, so offer it only when the user wants the whole category, and name the other zones it adds. Pass `allowNewKeys: true` only once a source of the key is confirmed: the user confirms the tag or page sends it, or `get_zone` shows a listed value in the `dataAttributesDefault` of a zone the entity can still reach after the edit (name those zones in the proposal). A default on an unreachable zone, or with another value, proves nothing: if no reachable source matches, say no matching traffic is verified before asking for confirmation. Removing the ad's last `params.zoneId` under a group with no zones makes the ad a free radical (every zone on the group's CAG and every zone with no CAG): say so in the proposal.
6. **Show current → proposed** for every field you will send, prices with their unit, targeting per key (values added and removed, a schedule as days × hours, and what it means in plain words), and say it goes live immediately. `null` removes a price.
7. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
8. **After the write**, report `changed`. After an on/off or targeting change, `explain_serve({ network_id, zoneId, adId })` shows whether the ad is live in a given zone. After a targeting change, read the top-level `verdict` and `conditions` back. Those combine the group's rules with the ad's, which is what decides where the ad serves. `offer` holds the ad's own rules and its live state. A list over 20 values comes back cut (`valuesTotal` greater than the `values` shown). If it is the rule this edit set, restate it from the confirmed proposal, labelled as the edited rule. Any other cut list, such as one the ad inherits from its group, can't be rebuilt from the proposal: say it is partial (how many values in all), or read the full rule with `get_ad_group` / `get_ad` before describing it. Never present a cut list as the whole rule. A rule on `geoState`, `device`, `deviceOs` or a time key makes the answer conditional, and that is the rule working; a rule on a key the zone sets (`zoneType`, `templateId`, `channelType`) or one in a zone's default data attributes can drop zones, and any other client key reads conditional: an `excludes` condition (a blacklist) works with no source, since a visit without the key passes it; a `requires` condition (a whitelist) succeeds only if the key has a source, so confirm the tag, page or a zone default sends it (see the reference's "Before and after"). `changed` shows a list over 20 values as a count (`[40 values]`): repeat a schedule from the confirmed proposal, not from `changed`.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_ads` with `adGroupId` for a create, `get_ad` for an edit) before anything else. Never retry blind — a create retry makes a duplicate.
- **"did not apply …"**: the API accepted the call but kept the old value. Re-read with `get_ad`; don't retry the same edit.
- **"changed since it was read"**: someone else edited the ad. Nothing was written. Re-read with `get_ad`, re-propose, and confirm again.
- **A WARNING that the ad group targets no zone**: the ad serves (or will, once the group is switched on) in every zone on its CAG and every zone with no CAG. Repeat it word for word; if the user didn't ask for that, suggest switching the ad off or adding zones to the group (`ad-group-editor` skill).
- **"Test creatives are on"**: the swap landed but changes nothing visible. Repeat which test creatives render; changing them is a Lincx UI job.
- **"minTrafficAllocation … was dropped"**: repeat the value; it is set again in the Lincx UI.
- **A creative refused** (another CAG, another advertiser, archived — "pick another creative"): report it and pick again with the user. Never swap in a creative they didn't choose.
- **"in both add and remove"**: the call itself is wrong; nothing was written. Rebuild it with each value in one of the two.
- **An input validation error on `params` / `exceptParams`** ("set replaces the whole list", "pass add, remove, or set", "values must not repeat", "targeting keys are 1–100 characters…", "is not allowed"): nothing was written. Fix the call shape (see the reference) and confirm again if the change itself moved.
- **"targeting problem"** (a value in the wrong format, a position key in params, a second time key in params, a blacklist naming every value, a value in both lists, a slot block on a key the group already blocks — "the group's list replaces the ad's"): nothing was written. Report each problem, fix the call with the user (see the reference), and confirm again. Never drop a value to get past it.
- **"not a Lincx targeting key"** (one key or several): likely a typo. Show the close matches from `get_event_stats_keys` and ask. Pass `allowNewKeys` only once a source of the key is confirmed.
- **"could not read the network's event keys"** or **"could not read the network's zones"**: the edit couldn't be checked, so nothing was written. Say so and retry once the user agrees.
- **A zone refused** (`params.zoneId` / `exceptParams.zoneId`: another CAG, archived, not in the network, or one the ad group can't reach — "not in ad group … zone whitelist", "in ad group …'s blacklist"): report each one. A zone the group can't reach is added to the group first (`ad-group-editor` skill). Don't swap in other zones without asking.
- **"Sum of ads traffic allocations within AdGroup should be equal or lower than 100%"** (update only — `create_ad` never sends an allocation): the edited ad is enabled and has its own `minTrafficAllocation`, and with the group's other enabled ads the total would go over 100%. Report it; allocations are changed in the Lincx UI.
- **"belongs to network …" / "is not in network …" / "is archived" / "not found"** (the ad, its group or the creative): report it. Don't swap in another entity without asking.
- **Forbidden**: the user can't write ads in this ad group or network. Say so; don't retry.
- **"Nothing to change"**: the ad already holds those values. Say so; no write happened.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Invent, round or reuse a price the user didn't give for this ad.
- Create or switch on an ad without saying where it will serve.
- Pass `allowNewKeys` without a confirmed source for the key (the tag or page, or a zone default).
- Build a `set` from memory, from an older read, or from an elided list.
- Offer to change what the tools can't: moving an ad to another ad group, cpmOverride, boost, limits, postback pixels, test creatives, traffic allocation, archive. Point the user to the Lincx UI.
- Bundle several writes, or several ads, into one confirmation.
- Pick a network for the user.
