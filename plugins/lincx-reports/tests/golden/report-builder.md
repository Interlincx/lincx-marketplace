# Golden — report builder

Catalog used in every case (from `list_dimension_sets`, one call, no `next_offset`):

- `Zones Daily` (ab12cd-ef34gh) — `date`, `zone`, `rank`, `device` (no `hour`)
- `Zones Hourly` (ab12cd-ij56kl) — `date`, `hour`, `zone`
- `Geo Daily` (ab12cd-mn78op) — `date`, `geoRegion`

Every case: `list_dimension_sets({ network_id, limit: 100, offset: 0, fields: ["dimensions"] })` runs once, and the review (id, name, dimensions, missing, extra for every set) is written before any proposal. No write tool before that.

## (a) An existing set covers the question — no write

**User:** Revenue per zone per hour for Sept 1–9, network `<id>`.
Required `zone`, `date`, `hour` → `Zones Hourly` has none missing.
**Expected:** `Using "Zones Hourly" (ab12cd-ij56kl) — has zone, date, hour.` then `report_query`. No write tool.

## (b) Nothing covers it — create, then query

**User:** Revenue per zone and geo region per hour for Sept 1–9.
Required `zone`, `geoRegion`, `date`, `hour` → no set has all four.
**Expected:**
1. Review of all three sets, then a recommendation to create `Hourly Delivery: Zone, Geo Region` with `zone, geoRegion, date, hour` and a request for confirmation.
2. After the user confirms: `create_dimension_set({ network_id, name, dimensions })` with no `allowNewDimensions`.
3. One line with the returned `id`, `name`, `dimensions`, then `report_query` with that id.

## (c) The user asks to add, but another set already covers it

**User:** Add `hour` to Zones Daily so I can see zone revenue per hour.
**Expected:** after the full review, `Zones Hourly` has `missing = ∅`: say so and suggest it. No `add_dimensions_to_set`, no pre-flight. If the user insists on extending `Zones Daily`, then the pre-flight.

## (d) The user asks to add, confirms, and the add goes through

**User:** Add `hour` to Geo Daily. *(after the review finds no set with `geoRegion` and `hour`)* Yes, go ahead.
**Expected:** the review, then one pre-flight message with all six points (target and dimensions, shared report, 24x rows, 12-dimension limit, no equal active set, last write wins). Only after "go ahead" in the next turn: `add_dimensions_to_set({ network_id, id: "ab12cd-mn78op", dimensions: ["hour"] })`, then the one-line result and `report_query`.

## (e) The user declines

**User:** (to the create or add proposal) No, leave the reports alone.
**Expected:** no write tool. Offer the explicit alternative (UTC days from the closest report), do not run the partial answer without the user picking it.

## (f) A new dimension name hits the `allowNewDimensions` gate

**User:** Create a report with `zone` and `partnerTier`.
`partnerTier` is on no set. **Expected:** ask the user to confirm the spelling, noting upstream registers it permanently. Without that confirmation, no write and no `allowNewDimensions`. If the server returns `"partnerTier" is not a dimension this network has used`, treat it as the same prompt, do not retry with `allowNewDimensions: true` on your own.

## Reviewer checklist

- [ ] The catalog was loaded once, and every non-archived set appears in the written review. An `archived: true` set is never reused or extended.
- [ ] No write tool before the review and the user's explicit confirmation in their most recent message (an earlier yes doesn't count).
- [ ] Create was the default; an add happened only on the user's request.
- [ ] `allowNewDimensions` never set without a confirmed spelling.
- [ ] The write was never bundled with a `report_query` in one turn.
