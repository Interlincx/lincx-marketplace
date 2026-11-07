# Smoke checklist

Run once per non-trivial plugin change. Takes ~5 minutes.

## Setup
1. `cd` to a scratch project directory.
2. `claude` — Claude Code session.
3. Confirm lincx MCP is connected: `/mcp`.

## Flow
1. `/lincx-template-new test-banner`, pick a CAG and paths.
   - Confirm the files appear, session state exists, preview opens in browser.
2. Make a small edit (change a color in CSS).
   - Confirm `preview.html` updates within ~2 s; refresh the browser tab.
3. `/lincx-template-load-ads <knownZoneId>`
   - Confirm preview now renders real ad content.
4. `/lincx-template-preview-toggle` → edit → confirm preview does **not** regenerate.
5. Toggle back on → edit → preview regenerates.
6. Open `./.lincx-session.log` — sanity-check hook/renderer messages.

## Failure paths to eyeball
- Corrupt `.lincx-session.json` — confirm Claude offers to archive and start fresh.
- MCP disconnected mid-session — confirm errors surface inline; cached schema preserved.
- Delete `ads/banner.html` between edit and render — confirm the log says `html missing` and nothing crashes.
