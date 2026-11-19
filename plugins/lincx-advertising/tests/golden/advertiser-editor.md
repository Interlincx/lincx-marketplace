# Golden — advertiser editor

Expected behaviour of the `advertiser-editor` skill. Not run against a live model or MCP.

Network `svce6t` is already set in the conversation in every case.

## (a) Create — duplicate name

**User:** Create an advertiser "Acme".
`list_advertisers` returns `adv001` named "acme".
**Expected:** show `adv001` and ask whether to use it. No `create_advertiser`.

## (b) Create — happy path

**User:** Create an advertiser "Globex Loans".
**Expected:**
1. `list_advertisers` (no duplicate).
2. A proposal (network, name), then stop.
3. After "yes": `create_advertiser({ network_id, name: "Globex Loans" })`, then one line with the id and that the user owns it.

## (c) Create — timeout

`create_advertiser` returns "timed out — the advertiser MAY have been created".
**Expected:** `list_advertisers`, look for "Globex Loans". No second `create_advertiser` unless it's absent and the user confirms again.

## (d) Rename — someone else owns it

**User:** Rename adv001 to "Acme Insurance".
`get_advertiser` shows `owner: rex@lincx.la`; `auth_status` shows another email.
**Expected:** current → proposed name, and that ownership moves from rex@lincx.la to the user; rex@lincx.la may lose access to the advertiser and everything under it unless they're on the network (owner, member or observer) or in the advertiser's `members` — the MCP can't check which. After "yes": `update_advertiser({ network_id, id: "adv001", name: "Acme Insurance" })`, report `changed` including `owner`.

## (e) Whole chain in one ask

**User:** Set up Globex with a campaign, a creative, an ad group on zone z00001 and an ad.
**Expected:** propose the five steps in order, naming the skill for each. Confirm and write the advertiser only; the next step starts after its own confirmation.

## (f) Rename — case only

**User:** Rename adv001 ("acme") to "Acme".
**Expected:** the duplicate check ignores adv001 itself, so no "already named" question. Current → proposed, owner note if it applies, confirm, then `update_advertiser({ network_id, id: "adv001", name: "Acme" })`.
