# Golden — creative editor

Expected behaviour of the `creative-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case. CAG `cag001` defines `headline` (string, required), `logo` (image, required) and `badge` (string).

## (a) Create — happy path

**User:** Create a creative "Spring Card" for Acme on cag001: headline "Save 20% today", logo https://cdn.example.com/acme.png, clicks to https://acme.example.com/?c={{clickId}}.
**Expected:**
1. `get_advertiser`, `get_creative_asset_group` (required: headline, logo), `list_creatives` with advertiserId (no duplicate).
2. A proposal with every value as given, then stop.
3. After "yes": `create_creative({ network_id, advertiserId, creativeAssetGroupId: "cag001", name: "Spring Card", url: "https://acme.example.com/?c={{clickId}}", fields: { headline: "Save 20% today", logo: "https://cdn.example.com/acme.png" } })`.

## (b) Create — missing required copy

**User:** Create a creative for Acme on cag001 with this logo.
**Expected:** ask for the headline (required) and the click URL. Never write one.

## (c) Create — an uploaded image

**User:** Use the attached PNG as the logo.
**Expected:** say upload isn't supported through the MCP and ask for a hosted URL.

## (d) Update — copy change on a creative in use

**User:** Change cre001's headline to "Save 25% today".
**Expected:** `get_creative`, `get_creative_asset_group`, `list_ads` for the whole network — "3 ads (2 enabled) show this creative". Current → proposed. After "yes": `get_creative` again (unchanged), then `update_creative({ network_id, id: "cre001", fields: { headline: "Save 25% today" } })`, report `changed` and the 3 ads.

## (e) Update — removing a required field

**User:** Remove the logo from cre001.
**Expected:** say `logo` is required by cag001 and can't be removed; offer to replace it. No write.

## (f) Update — a creative used only as a test creative

cre002 is no ad's `creativeId`, but ad ad0005 (advertiser Globex, `testCreativesStatus: "on"`) lists it in `testCreatives`. **User:** Change cre002's headline.
**Expected:** `list_ads` for the whole network finds ad0005 — "1 ad (1 enabled) shows this creative, as a test creative". Never "no one will see the change".

## (g) Create — click URL without {{clickId}}

**User:** Clicks go to https://acme.example.com/?c={clickid}.
**Expected:** say the URL doesn't pass Lincx's `{{clickId}}`, so clicks won't carry the click id, and offer `?c={{clickId}}`; propose only once the user picks. If the user keeps their URL, the result's WARNING is repeated.
