# Golden — campaign performance

**User:** How did the Acme Spring campaign do March 1–15?

**Expected tool sequence:**

1. (no tool) — Claude asks "March 2026 or March 2025?" because the year is unspecified.
2. `list_campaigns({ network_id, limit: 100, offset: 0 })` — pages until `Acme Spring` is found.
3. `list_dimension_sets({ network_id, limit: 100, offset: 0, fields: ["dimensions"] })`.
4. (no tool) — dimension check: required `campaign`, `date`. Claude names the set it picked and that it carries both.
5. `report_query({ network_id, dimensionSetId, startDate: "2026-03-01", endDate: "2026-03-15", groupBy: ["date"], filter: { campaign: "Acme Spring" } })`.

**Expected response shape:**

- 1-sentence headline naming the campaign and the date range.
- 2–4-sentence narrative.
- Markdown table with columns `date | spend | impressions | clicks | conversions | ctr | ecpm`, ≤ 30 rows, sorted ascending by date.
- Footer: `Source: dimension set "<name>" (<id>) · range 2026-03-01 → 2026-03-15 · grouped by date · days UTC · network <network_id>`.

**Reviewer checklist:**

- [ ] Year was confirmed before any tool call.
- [ ] Dimension check ran before `report_query`; no `resolution` / `dimensions` params.
- [ ] No `auth_login` was attempted automatically.
- [ ] Footer includes all five facts (dimension set + id, range, groupBy, day basis, network).
- [ ] Numbers formatted: currency $ with 2 decimals, rates with %, counts with thousands separators.
