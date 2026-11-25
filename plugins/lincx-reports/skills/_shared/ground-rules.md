# Ground rules — every Lincx report

- **Date range first.** If the user gave no date range, ask before any tool call (`_shared/date-range.md`). Never default one.
- **Auth.** On `"Error: Not authenticated"`, stop and ask the user to run `auth_login`. Do not run it for them: it opens a browser flow that needs their credentials.
- **Network.** Every MCP business tool takes a `network_id`; there is no active network. Use the network the user named, or the one already used earlier in this conversation. If there is none yet, show `network_list` and ask. Pass it on every call and keep it until the user explicitly asks to switch. Never pick or switch a network on your own, and never combine data across networks.
- **One report per question.** A request that blends two reports ("revenue and top creatives this week") runs as two separate reports, one after the other. Do not merge them.
- **Dimension check before `report_query`** (`_shared/dimension-discovery.md`). Never answer from a report that lacks a dimension the question needs.
- **Only `lincx-report-builder` creates or extends a report.**
- **Never speculate on causes** the data does not show.
