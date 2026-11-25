# Report write tools — `create_dimension_set`, `add_dimensions_to_set`

These change what Reports Center shows. Call them only after the full catalog is loaded and every set is reviewed (the checklist in `SKILL.md`). Both need explicit confirmation (the user's most recent message, not an earlier yes), and neither is bundled with a `report_query`.

- `create_dimension_set({ network_id, name, dimensions })` — `name` up to 50 characters, `dimensions` the required names (`date`, `networkId` and the id/name pairs are added for you). If an active report already has exactly these dimensions it returns that one and creates nothing. It is **not idempotent**: after `"Error: create timed out"` or a 5xx, re-list with `list_dimension_sets` and look for the name before retrying.
- `add_dimensions_to_set({ network_id, id, dimensions })` — only adds, never removes. Changes a report other people use. If the report already has them it writes nothing. If the result would equal another active report, upstream refuses and names it: use that one. Last write wins on a concurrent edit.
- `allowNewDimensions: true` on either — only when the name is on no set in the network, is not a core event column, and the user confirmed the spelling. Upstream registers it permanently. Without it, a name the network has never used returns `"Error: "x" is not a dimension this network has used…"`: re-check the spelling against the catalog.
- `"Error: Forbidden — your user can't create reports on network <id>."` (or `edit`) — say so and stop. Do not retry or try the other tool.
- After a write, one line with `id`, `name` and `dimensions`, then `report_query` with that id. The returned dimensions are not in the order you sent; that is normal.
