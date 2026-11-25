# TODO

Deferred items from the initial build.

## Renderer upgrade — full Mustache support

The local preview renderer (`plugins/templates-editor-plugin/scripts/preview-render.mjs`) currently supports only `{{ var }}` and `{{& var }}` unescape. Real Lincx templates use:
- `{{{ var }}}` triple-brace unescape
- `{{#section}}…{{/section}}` sections (iteration over arrays)
- `{{.}}` current-item in array sections
- `{{^section}}…{{/section}}` inverted sections (rare in our templates)

With the current renderer, preview of a real template renders CSS/layout correctly but leaves triple-brace tokens and section tags as literal text. Impact is documented in `rendering-convention.md` and `references/anti-patterns.md`.

- [ ] Upgrade `scripts/preview-render.mjs` to parse full Mustache — simplest path is to inline a small Mustache implementation (the full spec isn't large; stdlib-only is preferable over adding a dependency).
- [ ] Extend `tests/preview-render.test.mjs` with fixtures covering triple-brace, `{{#ads}}` iteration, `{{.}}` current-item, and `{{^}}` inverted sections.
- [ ] Update `tests/fixtures/simple-template/` or add a new fixture that uses full Mustache so the fixture-equality test covers the upgraded behavior.
- [ ] Once done, remove the "renderer support status" caveat from `references/rendering-convention.md` and the "Using the local preview to verify copy correctness" anti-pattern entry.

## Task 15 — manual smoke test with live Lincx MCP

Requires a live Lincx MCP session — was skipped during the automated build because the MCP was disconnected.

Run `plugins/templates-editor-plugin/tests/smoke.md` top to bottom:

1. `cd` into a scratch project dir, start Claude Code, confirm `/mcp` shows the Lincx MCP connected.
2. `/lincx-template-edit <knownTemplateId>` → pick paths → confirm files appear, session state created, preview opens in browser.
3. Edit the CSS → confirm `preview.html` updates within ~2 s.
4. `/lincx-template-load-ads <knownZoneId>` → confirm preview renders real ad content.
5. `/lincx-template-save` → confirm `ads/versions/v1.html` exists and is self-contained.
6. Edit again, save again → confirm `v2.html` appears with a diff summary.
7. `/lincx-template-preview-toggle` → edit → confirm preview does NOT regenerate. Toggle back on → regenerates.
8. Check `./.lincx-session.log` for clean hook/renderer messages.

### From-scratch path
1. `/lincx-template-new test-banner` → pick a CAG → author a simple banner.
2. Confirm consult-references rule kicks in (skill reads `references/` visibly).
3. Preview renders with synthesized ads.

### Failure-path spot checks
- Corrupt `.lincx-session.json` → skill offers archive + fresh start.
- MCP disconnected mid-session → errors surface inline; cached schema preserved.
- Delete `ads/banner.html` between edit and render → log says "html missing"; no crash.

### On pass
- [ ] `git tag -a templates-editor-plugin-v0.1.0 -m "templates-editor-plugin v0.1.0"`
- [ ] Record any friction/surprises as new items here or as GitHub issues.
