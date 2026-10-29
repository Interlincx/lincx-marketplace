---
name: lincx-report-builder
description: Use when a Lincx question needs dimensions no report has, or the user asks to create or extend a report (dimension set). Loaded by the lincx-reports router.
---

# Lincx — Report builder

A report is a dimension set. `create_dimension_set` makes a new one; `add_dimensions_to_set` changes one other people already use. The default is to **create**, and no write happens until you have reviewed every set on the network. The rules for picking are in `references/decision-table.md`.

## Checklist — a hard gate, in order

Do not call a write tool until step 3's review is written down in the conversation.

1. **Derive the required dimensions** per Step 1 of `_shared/dimension-discovery.md`. Copy the exact, case-sensitive names from the catalog.
2. **Load the full catalog once:** `list_dimension_sets({ network_id, limit: 100, offset: 0, fields: ["dimensions"] })`, paging with `offset` until `next_offset` is gone. Never decide on a partial catalog.
3. **Review every set** and write the review down before proposing anything. Skip sets with `archived: true`: they can't be extended and don't block a create. For each remaining set: its id, name, dimensions, `missing = required − dimensions` and `extra = dimensions − required`. A set that is not in the review does not exist for the decision.
4. **Decide, in this order:**
   1. **A set already covers everything** → use it, no write. Several → the one with the fewest extras.
   2. **No set covers it** → recommend **create** with exactly the required dimensions.
   3. **Add to an existing set** only if the user asks for it, or create is blocked (the 50-report cap, or an identical report). Closest set first: fewest missing, then fewest extras.
5. **Pre-flight before any add**, all in one message:
   - the target report and the exact dimensions to add,
   - that it changes a report other people use (its row count and what their exports show),
   - that adding `hour` makes about 24x more rows,
   - that the 12-dimension limit (beyond the entity and date ones) still holds after the add,
   - that the result does not equal another active set, checked against step 3's review,
   - that last write wins if someone edits the same report at the same time.
6. **Get explicit confirmation**, for a create as well as an add: propose the report name and dimensions (a create) or send the pre-flight (an add), then stop and wait. Write only when the user's most recent message confirms it; a yes from earlier in the conversation doesn't count. No silent writes, and never bundle the write with the query.
7. **`allowNewDimensions` stays unset** unless the name is missing from every set on the network, is not a core event column (`geoRegion`, `device`, `rank` and the like), **and** the user confirms the spelling. Upstream registers it permanently.
8. **After the write**, one line with the `id`, `name` and returned `dimensions`. Then run `report_query` against that id, per `_shared/mcp-call-patterns.md`.
9. **On a timeout**, create is not idempotent: re-list with `list_dimension_sets` and look for the name or dimensions before retrying.

## Naming a new report

The name describes all of the report's non-automatic dimensions, within 50 characters: `Hourly Delivery: Zone to Ad, Rank, Device`. These tools can't rename a report, so after an add the name stays; pick the name with likely additions in mind.

## What you never do

- Call `create_dimension_set` or `add_dimensions_to_set` before the full catalog is loaded and reviewed.
- Add to the report you happen to be looking at without comparing every other set.
- Add when a new report would do, or when another set already covers the question.
- Offer to remove dimensions or rename a report. The tools cannot.
- Write without explicit confirmation in the user's most recent message.
- Pass `allowNewDimensions` to get past a refusal without the user confirming the spelling.
- Pick a network for the user (see the `lincx-reports` router).
