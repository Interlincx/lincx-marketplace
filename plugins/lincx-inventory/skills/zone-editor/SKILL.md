---
name: zone-editor
description: Use when the user asks to create a Lincx zone, or to rename a zone, change its template or creative asset group (CAG), or set or remove its data-attribute defaults. Gates create_zone and update_zone behind reads and confirmation.
---

# Lincx — Zone editor

`create_zone` adds a zone to a site. `update_zone` edits a zone's name, template, CAG or data-attribute defaults, and **the edit goes live immediately** — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_zone` or `update_zone` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Create checklist — a hard gate, in order

1. **Resolve the site** with `get_site` (or `list_sites` to find it by name). The zone's publisher and channel come from the site; never ask for them.
2. **Check for a duplicate:** `list_zones({ network_id, siteId })`. If a zone with the same name exists, show it and ask whether to use it instead.
3. **Pick the template**, if the user wants one: `list_templates({ network_id, publisherId })` with the site's publisher. Its CAG becomes the zone's unless the user names another, and a different one is rejected.
4. **No CAG at all** opens the zone to every untargeted ad group on the network. Do it only when the user says that is intended.
5. **`type`** becomes the case-sensitive `zoneType` targeting key. Take it from the user word for word; never invent one.
6. **Propose and get explicit confirmation:** site, name, template, CAG, type, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
7. **After the write**, one line with the returned `id`, and say the zone gets no traffic until its tag is on a page.

## Update checklist — a hard gate, in order

1. **Read the zone** with `get_zone`. Never build an edit from memory or from an older read.
2. **Show current → proposed** for every field you will send, and say it goes live on the zone immediately.
3. **Template or CAG change:** the CAG decides which ad groups can serve. Before the write, take `summary` from `get_zone_eligible_ad_groups({ network_id, zoneId })` and say what it is now.
   - To switch the template to one with a different CAG, pass both in one call.
   - On a zone with segments on, the template only covers the zone's own share; each segment renders its own. A CAG change is refused until every segment's template has the new CAG — send the user to the Lincx UI for the segments, don't retry.
4. **`dataAttributesDefault`** merges: a string sets a key, `null` removes it, keys not sent are kept. Each default is what targeting sees on visits that don't send the key, **and** it is written onto every tracked event of the zone. Say both. A refused key is refused for a reason: don't try another spelling of it.
5. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
6. **After the write**, report `changed` (only fields whose value changed). After a template or CAG change, read `get_zone_eligible_ad_groups` `summary` again and show before vs after.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_zones` with `siteId` for a create, `get_zone` for an update) before anything else. Never retry blind — a create retry makes a duplicate.
- **The stored defaults changed since the read:** someone else edited the zone. Re-read with `get_zone`, re-propose, and confirm again.
- **"Nothing to change":** the zone already holds those values. Say so; no write happened.
- **A refusal naming a site, template or CAG** (missing, archived, another network): report it. Don't swap in a different entity without asking.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Offer to change what the tools can't: site, publisher, channel, network, `type` after create, segments, allow/blocklists, forced ads, scoring override, postback pixels, test templates. Point the user to the Lincx UI.
- Bundle a write with an unrelated question, or edit several zones from one confirmation the user didn't give for each.
- Pick a network for the user.
