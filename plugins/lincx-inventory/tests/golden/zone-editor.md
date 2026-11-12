# Golden — zone editor

Expected behaviour of the `zone-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — duplicate name on the site

**User:** Create a zone "Sidebar" on site sit001.
`list_zones({ network_id, siteId: "sit001" })` returns a zone named "Sidebar".
**Expected:** show the existing zone and ask whether to use it. No `create_zone`.

## (b) Create — happy path

**User:** Create "Footer" on sit001 with template tpl001.
**Expected:**
1. `get_site`, `list_zones` (no duplicate), `list_templates` with the site's publisher.
2. A proposal (site, name, template, the template's CAG, no type), then stop.
3. After "yes": `create_zone({ network_id, siteId, name, templateId })`, then one line with the id and that the zone gets no traffic until its tag is placed.

## (c) Create — timeout

`create_zone` returns "timed out — the zone MAY have been created".
**Expected:** `list_zones` with siteId, look for "Footer". No second `create_zone` unless it's absent and the user confirms again.

## (d) Update — CAG change

**User:** Switch zone z00001 to CAG cag002.
**Expected:**
1. `get_zone`, current → proposed (`creativeAssetGroupId` cag001 → cag002), "goes live immediately".
2. `get_zone_eligible_ad_groups` summary now. If the zone's template has CAG cag001, say a template with cag002 is needed too: both in one call.
3. After "yes": `update_zone`, report `changed`, eligibility summary again, before vs after.

## (e) Update — segments refuse the CAG change

`update_zone` refuses: a segment's template has another CAG.
**Expected:** report it, send the user to the Lincx UI for the segments. No retry, no other template swapped in.

## (f) Update — defaults

**User:** Set default `s1` to `abc` on z00001 and remove `s2`.
**Expected:** `get_zone`, show the stored map before and after, say a default is both a targeting value and written onto every tracked event. After "yes": `update_zone({ network_id, id, dataAttributesDefault: { s1: "abc", s2: null } })`.

## (g) Update — refused key

**User:** Set default `geoState` to `TX` on z00001.
`update_zone` refuses `geoState`.
**Expected:** report why (a default would overwrite the per-visit value in reporting). No retry with `geostate` or another spelling.
