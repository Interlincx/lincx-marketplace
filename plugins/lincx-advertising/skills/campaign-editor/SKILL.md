---
name: campaign-editor
description: Use when the user asks to create a Lincx campaign, or to rename a campaign, change its flight dates, or switch it on or off. Gates create_campaign and update_campaign behind reads and confirmation.
---

# Lincx — Campaign editor

`create_campaign` adds a campaign under an advertiser. `update_campaign` edits a campaign's name, flight dates or on/off state, and **the edit goes live immediately for every ad group and ad under the campaign** — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_campaign` or `update_campaign` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Dates

`dateStart` / `dateEnd` are `YYYY-MM-DD` days judged in **UTC**: the campaign starts at 00:00 UTC on `dateStart` and stops at 00:00 UTC the day after `dateEnd` (the end day is inclusive). A missing bound is open. When the user's timezone puts 00:00 UTC on a different local day (the evening before, in the Americas), say so. `dateStart` must be on or before `dateEnd`. On an edit, `null` removes a bound.

## Create checklist — a hard gate, in order

1. **Resolve the advertiser** with `get_advertiser` (or `list_advertisers` to find it by name). A campaign can't move to another advertiser later.
2. **Check for a duplicate:** `list_campaigns({ network_id, advertiserId, fields: ['id', 'name'] })`, paging until `next_offset` is null. If one has the same name (case doesn't matter), show it and ask whether to use it instead. The tool does not refuse a duplicate name, so this check is the only guard.
3. **Dates**, if the user gave any (see Dates). `dateStart` must be on or before `dateEnd`, and a `dateEnd` already past is refused — the campaign would never serve.
4. **`enabled`** defaults to true, as in the Lincx UI. A new campaign has no ad groups, so nothing serves yet either way.
5. **Propose and get explicit confirmation:** network, advertiser, name, dates, enabled, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
6. **After the write**, one line with the returned `id`. If the user is building a new setup, the next step is a creative (`creative-editor` skill) or an ad group (`ad-group-editor` skill).

## Update checklist — a hard gate, in order

1. **Read the campaign** with `get_campaign`. Never build an edit from memory or from an older read.
2. **Count what it affects:** `list_ad_groups({ network_id, campaignId, fields: ['id', 'name', 'enabled', 'params.zoneId'] })`, paging until `next_offset` is null. Say how many ad groups (and how many are enabled) the change reaches. When turning the campaign on or widening its window, name every enabled ad group with no `params.zoneId`: it will serve in every zone on its creative asset group, and in every zone with no creative asset group.
3. **Show current → proposed** for every field you will send: on/off and the window, before and after. A campaign serves only while enabled **and** inside its window, judged in UTC. Don't work out from your own clock whether it serves today — it may not be UTC. The `serving` field `update_campaign` returns is the answer after the write; `get_zone_targeting_inventory` reports a campaign out of its window as `campaign-window`.
   - `enabled: false` stops every ad group and ad under it. A `dateEnd` in the past stops them too, but only while it stays on or after `dateStart` — to stop a campaign that starts today, use `enabled: false`.
   - `enabled: true`, or widening the window, starts every one of them that is otherwise live — including the untargeted ad groups from step 2.
4. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
5. **After the write**, report `changed` and `serving`. To show the effect on a zone, `get_zone_targeting_inventory` reports a campaign off as `campaign` and out of its window as `campaign-window`.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_campaigns` with `advertiserId` for a create, `get_campaign` for an edit) before anything else. Never retry blind — a create retry makes a duplicate.
- **"did not apply …"**: the API accepted the call but kept the old value. Re-read with `get_campaign` and report what it holds; don't retry the same edit.
- **"dateStart must be on or before dateEnd"** (edit) / **"is after dateEnd"** (create): the window is inverted — on an edit, the new value clashes with the stored other bound. Show both dates and ask which to change.
- **"is already past"** (create): the `dateEnd` is before today in UTC, so the campaign would never serve. Ask for the real end date.
- **Any other refusal** — **"Nothing to change"**, **"belongs to network …" / "is not in network …" / "is archived" / "not found"**, **Forbidden**: nothing was written. Report it as the tool worded it. Don't retry, and don't swap in another campaign or advertiser without asking.

## What you never do

Beyond the checklists above:

- Switch a campaign on or off without saying how many ad groups it reaches.
- Turn a campaign on, or widen its window, without naming its enabled ad groups that have no zone targeting.
- Offer to change what the tools can't: the advertiser, archive or unarchive. Point the user to the Lincx UI.
- Bundle several writes, or several campaigns, into one confirmation.
