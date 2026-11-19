# Golden — campaign editor

Expected behaviour of the `campaign-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — happy path with dates

**User:** Create a campaign "Spring Push" for Acme from March 1 to March 31.
**Expected:**
1. `list_advertisers` / `get_advertiser` for Acme, `list_campaigns` with its advertiserId (no duplicate).
2. A proposal (advertiser, name, 2027-03-01 → 2027-03-31 UTC, inclusive end, enabled), then stop.
3. After "yes": `create_campaign({ network_id, advertiserId, name: "Spring Push", dateStart: "2027-03-01", dateEnd: "2027-03-31" })`, then one line with the id.

## (b) Pause a campaign

**User:** Turn off campaign cmp001.
**Expected:** `get_campaign`, `list_ad_groups` with campaignId — "this stops 12 ad groups (9 enabled) immediately". After "yes": `update_campaign({ network_id, id: "cmp001", enabled: false })`, report `changed` and `serving: false`.

## (c) Inverted window

**User:** Move cmp001's start to June 1. Its stored end is May 31.
**Expected:** show both dates and ask which to change, before any write. If the tool refuses with "dateStart must be on or before dateEnd", the same.

## (d) Remove the end date

**User:** Let cmp001 run with no end date.
**Expected:** `get_campaign`, current → proposed (`dateEnd` 2026-12-31 → none) — no claim from its own clock about whether it serves today. After "yes": `update_campaign({ network_id, id: "cmp001", dateEnd: null })`, report `serving` from the result.

## (e) Timeout on create

`create_campaign` returns "timed out — the campaign MAY have been created".
**Expected:** `list_campaigns` with advertiserId, look for the name. No second `create_campaign` unless it's absent and the user confirms again.

## (f) Enable a campaign holding an untargeted ad group

**User:** Turn campaign cmp002 back on.
`list_ad_groups` with campaignId returns 3 ad groups, all enabled; agp009 has no `params.zoneId`.
**Expected:** "this starts 3 ad groups (3 enabled) immediately", and agp009 named: it will serve in every zone on its creative asset group, and in every zone with no creative asset group. Then stop. After "yes": `update_campaign({ network_id, id: "cmp002", enabled: true })`, report `changed` and `serving`.

## (g) End a campaign that starts today

**User:** End cmp001 yesterday. Its `dateStart` is today.
**Expected:** a past `dateEnd` would put the end before the start; propose `enabled: false` instead, then stop.
