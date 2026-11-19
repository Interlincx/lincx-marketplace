---
name: creative-editor
description: Use when the user asks to create a Lincx creative (the content an ad renders — headline, image, click URL and the other fields its creative asset group defines), or to rename one, change its click URL or edit its field values. Gates create_creative and update_creative behind reads and confirmation.
---

# Lincx — Creative editor

`create_creative` adds a creative for an advertiser on a creative asset group (CAG). `update_creative` edits its name, click URL or field values, and **the edit goes live immediately on every ad that uses the creative**, in every zone they serve — there is no draft step. Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_creative` or `update_creative` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## What a creative holds

- **The CAG decides the fields.** Read it with `get_creative_asset_group`: `fields.properties` names every field and its type, `fields.required` the ones that must be set. Only those fields exist; a field the CAG doesn't define is refused.
- **Types:** text (`string`), whole number (`integer`), true/false (`boolean`), a list of values (`array`, item type in `items.type`), and `image` — an http(s) URL of an image that is **already hosted**. Uploading a file is not supported through the MCP; ask the user for the hosted URL.
- **A fixed list:** a field with an `enum` array takes exactly one of those values, whatever its `type` (which may be missing).
- **`url` is the click-through URL**, http(s) only, at most 1000 characters. Macros such as `{{clickId}}` are allowed and stay as written. It should pass `{{clickId}}` (or `{{adverseClickId}}`) so clicks carry Lincx's click id; if the user's URL doesn't, say so before proposing — the tools save it anyway and warn, as the Lincx UI does.
- **Text is shown as written.** Use the user's copy exactly; don't rewrite, shorten or translate it unless they ask. If a required field has no copy from the user, ask for it — never make it up.
- The CAG and advertiser can't change after the creative is created.

## Create checklist — a hard gate, in order

1. **Resolve the advertiser** with `get_advertiser` (or `list_advertisers`).
2. **Pick the CAG** (`list_creative_asset_groups({ network_id })`) and read it with `get_creative_asset_group`. It must be the CAG of the ad groups this creative will be used in.
3. **Fill every required field** from the user's input, and any optional ones they gave. Missing required copy or image: ask.
4. **Check for a duplicate:** `list_creatives({ network_id, advertiserId, fields: ['id', 'name'] })`, paging until `next_offset` is null. If one has the same name, show it and ask whether to use it instead.
5. **Propose and get explicit confirmation:** network, advertiser, CAG, name, click URL and every field value, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
6. **After the write**, one line with the returned `id`. It serves nowhere until an ad uses it (`ad-editor` skill).

## Update checklist — a hard gate, in order

1. **Read the creative** with `get_creative`, and its CAG with `get_creative_asset_group` when fields change. Never build an edit from memory or from an older read.
2. **Count what it affects:** `list_ads({ network_id, fields: ['id', 'name', 'creativeId', 'testCreatives', 'testCreativesStatus', 'enabled', 'archived'] })` for the **whole network** (not just the creative's advertiser — another advertiser's ad can use it as a test creative), paging until `next_offset` is null. Keep the **non-archived** ads whose `creativeId` is this creative **or** whose `testCreatives` list it. The tool doesn't count them — this read is the only count, so never skip it. Say how many (and how many are enabled) will show the change; never say no one will see it unless both counts are zero.
3. **Show current → proposed** for every field you will send. `fields` merges: a value sets a field, `null` removes it, fields not sent are kept. A required field can't be removed or blanked.
4. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
5. **On the confirming turn, re-read** with `get_creative` before writing. If anything you proposed to change differs from that read, show the difference and confirm again — never overwrite an edit made since the proposal.
6. **After the write**, report `changed` and the ad count from step 2, and repeat any WARNING the result carries.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_creatives` with `advertiserId` for a create, `get_creative` for an edit) before anything else. Never retry blind — a create retry makes a duplicate.
- **"field problem(s)"**: each line names the field and what's wrong (not a field of the CAG, wrong type, required). Fix those with the user and confirm again; don't guess a replacement value.
- **"url must be an http(s) URL"**: the click URL isn't a web address. Ask for the right one.
- **"url has an unbalanced {{macro}}"**: a `{{` without its `}}` (or the reverse). Show the URL and ask the user to fix it.
- **"belongs to network …" / "is not in network …" / "is archived" / "not found"** (the advertiser, CAG or creative): report it. Don't swap in a different entity without asking; an archived creative is unarchived in the Lincx UI.
- **Forbidden**: the user can't write creatives for this advertiser or network. Say so; don't retry.
- **"did not apply …"**: the API accepted the call but kept the old value. Re-read with `get_creative`; don't retry the same edit.
- **"changed since it was read"**: someone else edited the creative (or removed the same field) since the tool read it. Nothing was written. Re-read with `get_creative`, re-propose, and confirm again.
- **A WARNING that the click URL doesn't pass `{{clickId}}`** (or has it in the wrong format): the write landed, but clicks won't carry Lincx's click id. Repeat it and offer to fix the URL.
- **"Nothing to change"**: the creative already holds those values. Say so; no write happened.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or an edit before re-reading what landed.
- Make up ad copy, a click URL or an image URL the user didn't give.
- Edit a creative without saying how many ads show it.
- Offer to change what the tools can't: the CAG, the advertiser, remote feeds, group offers, delta-based pricing, file uploads, archive. Point the user to the Lincx UI.
- Bundle several writes, or several creatives, into one confirmation.
- Pick a network for the user.
