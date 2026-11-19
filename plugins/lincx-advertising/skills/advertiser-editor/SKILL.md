---
name: advertiser-editor
description: Use when the user asks to create a Lincx advertiser or rename one, or asks how to set up a new advertiser end to end (advertiser, campaign, creative, ad group, ad). Gates create_advertiser and update_advertiser behind reads and confirmation.
---

# Lincx — Advertiser editor

`create_advertiser` adds an advertiser to a network. `update_advertiser` renames one. An advertiser is the top of the advertising chain; nothing serves from it alone, but a rename is shown everywhere at once and **moves the advertiser's ownership to you** (see below). Neither tool is undone by retrying, so no write happens until the reads below are done and the user has confirmed.

If `create_advertiser` or `update_advertiser` is not in your tool list, say the Lincx MCP doesn't offer it yet and stop. Never fall back to another tool.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Setting up a new advertiser end to end

The chain is built in this order, one confirmed write at a time — each step needs the id the previous one returned:

1. **Advertiser** — this skill.
2. **Campaign** under the advertiser — the `campaign-editor` skill.
3. **Creative** for the advertiser, on a creative asset group (CAG) — the `creative-editor` skill.
4. **Ad group** under the campaign, on the same CAG, targeted to zones — the `ad-group-editor` skill.
5. **Ad** placing the creative in the ad group — the `ad-editor` skill. This is the step that makes something serve.

Propose the whole plan first if the user asked for all of it, then confirm and write each step on its own. Never chain several writes from one confirmation. If the skill for a step isn't installed, say so and stop at that step — don't improvise the write without it.

## Create checklist — a hard gate, in order

1. **Check for a duplicate:** `list_advertisers({ network_id, fields: ['id', 'name', 'archived'] })`, paging until `next_offset` is null. A row with no `archived` key is active (upstream omits it, so `unknown_fields: ["archived"]` on a page is expected). If an **active** (not archived) advertiser has the same name (case doesn't matter), show it and ask whether to use it instead. An archived one doesn't block the name. The tool applies the same rule; checking first saves a refused call.
2. **The name** is at most 50 characters, one line. Use the user's words; don't polish them.
3. **Propose and get explicit confirmation:** network, name, then stop. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count.
4. **After the write**, one line with the returned `id`, and say the advertiser is owned by the user who created it. Offer the next step of the chain if the user is setting one up.

## Rename checklist — a hard gate, in order

1. **Read the advertiser** with `get_advertiser`. Never build an edit from memory or from an older read.
2. **Check the new name** against `list_advertisers` the same way as on create, ignoring the advertiser being renamed — a case-only rename (`acme` → `Acme`) is fine.
3. **Ownership moves to you.** The Lincx API makes whoever edits an advertiser its owner, on every edit. Compare the advertiser's `owner` with the email `auth_status` shows. If they differ, say so plainly: the current owner may lose access to this advertiser and its campaigns, ad groups, ads and creatives, unless they are on the network (owner, member or observer) or in the advertiser's `members`. The MCP can't check which applies, so say that too. This can't be avoided through the MCP.
4. **Show current → proposed** name, and the owner change when there is one.
5. **Get explicit confirmation**, then stop. Write only when the user's most recent message confirms it.
6. **After the write**, report `changed`. If `owner` is in it, repeat who the owner is now.

## Reading the result

- **"MAY have been created/applied"** or **"most likely applied"** (a timeout, a 5xx, a 2xx with no body): the write may have landed. Re-read (`list_advertisers` for a create, `get_advertiser` for a rename) before anything else. Never retry blind — a create retry makes a duplicate.
- **"already named"**: another active advertiser has that name. Show it; ask the user for another name or to use that one.
- **"Nothing to change"**: the advertiser already has that name. Say so; no write happened.
- **"belongs to network …" / "is not in network …" / "is archived" / "not found"**: report it. Don't switch to another advertiser without asking.
- **"could not read the network's advertisers to check for a duplicate name"**: nothing was written — the duplicate check couldn't run. Say so and try again later; never write without that check.
- **Forbidden**: the user can't write advertisers on this network. Say so; don't retry.

## What you never do

- Write without explicit confirmation in the user's most recent message.
- Retry a create or a rename before re-reading what landed.
- Rename an advertiser someone else owns without saying ownership moves.
- Offer to change what the tools can't: owner, members, archive or unarchive. Point the user to the Lincx UI.
- Bundle several writes, or several advertisers, into one confirmation.
- Pick a network for the user.
