---
name: zone-targeted
description: Use when the user asks which ad groups are directly targeted to a Lincx zone, or whether a zone's targeted ad groups are live/off — the exhaustive zone-targeting inventory with an enabled-state rollup. Backs the /zone-targeted command.
---

# Lincx — Zone targeting inventory

Answer: "For zone Z, list every ad group **directly targeted** to it, and for each
whether it is **fully live** (campaign + ad group + ad all enabled with a viable
creative attached) or **where it is off**." Exhaustive.

## Network

Every MCP business tool requires `network_id`. There is no active network, and `auth_status` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with `network_list`.
- **None in the conversation yet:** show `network_list` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (`network <network_id>`), so a wrong network is visible.

## Inputs
- `network_id` — required, see Network above.
- `zoneId` — required (the command resolves it, remembering the last one).
- `mode` — `all` (default) | `live` (only fully-live) | `off` (only not-fully-live).

## Flow

1. Call **`get_zone_targeting_inventory({ network_id, zoneId, mode })`**. It does the whole audit
   server-side. The result is the tool's **text content**: a one-line header, a
   blank line, then compact JSON. **Parse the JSON** (everything after the first
   blank line) to get `{ zone, summary, groups[], conflicting[], scan }`. Each
   `groups[]` row carries `campaign_on`, `adgroup_on`, `has_live_viable_ad`,
   `fully_live`, `off_reason`, `archived` (plus `has_enabled_ad` / `creative_resolves`
   diagnostics). **Do NOT scan ad groups yourself** — the tool is exhaustive; the old
   client-side `list_ad_groups` scan is gone.
2. Render a markdown table from `groups`: one row per ad group with a ✅/❌ per level
   (campaign / ad group / live+viable ad) and the `off_reason` when not fully live.
   Head it with the network, the zone name / CAG / template and the summary line
   (`N targeted · X live · Y off · Z archived · C conflicting`). The `groups` array
   is **always complete** — every targeted ad group is present. Group the table by
   fully-live / off-non-archived / off-archived for readability.
   - If `summary.conflicting > 0`, list the `conflicting` groups below the table
     (they target AND except the zone — excluded from targeting).
   - If the result has **`namesOmitted: true`** (only on very high-count zones), the
     rows carry ids + flags but no names — render with ids; the list is still
     complete. If it has **`complete: false`** (pathological sizes only), the tool
     returned ids only — re-run once per `mode` (`live` then `off`) to get the full
     detail in splits; never present it as complete. Otherwise the response is
     complete with names — do not caveat completeness.

## Guardrails
- Pass `network_id` on every call (see Network), and name it in the answer.
- On `"Error: Not authenticated…"` surface it and ask the user to run `auth_login`;
  do not retry. On `"Error: Resource not found…"` the zone ID is wrong — do not
  invent one. On `"Error: Forbidden…"` the user can't see that resource on the network you used: say which `network_id` you called with and ask whether they meant another network. Do not switch on your own.

## Out of scope
"Free radicals" — ad groups targeting no zone that still render via the zone's shared
CAG. Eligibility, not direct targeting; a later `mode` on the composite.
