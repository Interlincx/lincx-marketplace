# Review Guidelines

This repo ships Claude Code plugins and portable Agent Skills that run on top of the Lincx MCP (@repo:Interlincx/lincx-mcp). Most changes are instructions to an LLM, so review them for what a model will do when it follows them literally.

## Blocking

- **Only real MCP tools.** Every tool a skill, command or reference names must be listed in `mcp-tools.json` (`node scripts/check-mcp-tool-refs.mjs` checks this). A skill that calls a tool the server does not register fails for every user.
- **`network_id` comes from the conversation.** Every business tool call passes `network_id` explicitly. Flag any wording that assumes an active or session network, or that offers to switch one.
- **Writes are gated.** A skill that calls a write tool (`create_*`, `update_*`, `add_*`) first does the reads it needs, proposes the exact change, and writes only on the user's latest explicit confirmation. A live edit (template, zone) says it goes live immediately.
- **Read tool output as documented.** Skills interpret fields (`verdict`, `complete`, `next_offset`, `offers.*`, `unservedShare`) as lincx-mcp's `CLAUDE.md` defines them. Flag a skill that treats a partial answer (`complete: false`, a `next_offset` still present, `groupsTruncated`) as the whole answer.
- **No invented data.** A skill never fills missing rows, ids or numbers, and never presents a guess as a platform result.

## Release

- A change under `plugins/<name>/` bumps that plugin's `version` in `.claude-plugin/plugin.json`, or installed copies never update.
- A new plugin is listed in `.claude-plugin/marketplace.json` and the README table.
- Scripts stay Node stdlib only (no `npm install` for users). A changed script keeps its tests in `plugins/<name>/tests/` passing.

## Scope

- Multi-step workflows (render, preview, load traces, report building) belong here, not in the MCP server. A change that needs a new server-side tool should name the lincx-mcp issue rather than work around the missing tool.
