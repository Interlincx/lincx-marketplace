# Save, verify, report

Loaded from `SKILL.md` at step 12 (save) and before saying done.

## Save by name

The template name is deterministic, so a re-run updates the same template instead of making a duplicate:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs name --prefix "<prefix>" --client <network id> --url <site url> --widget <type> --version <baseline version>`
- Look it up with `list_templates` (the publisher, in the network), paging until `next_offset` is absent: a match on a later page would turn `create` into a duplicate. Read the match in full with `get_template` `part: 'html'` / `'css'` (see the ground rule), never the truncated response. Write `{ name, html, css, creativeAssetGroupId }` and the matches to files and run `restyle.mjs plan-save --existing <file> --desired <file>`.
- `create`: a new template. `patch`: same html and CAG, new css: update it. `none`: nothing changed. `stop`: duplicate names or drift (the html or CAG no longer matches the baseline copy); do not write, tell the user.
- A new template sets `tieringEnabled: false`. `create_template` has no `notes` field, so the history line `[Auto - system generated] Created from bundled baseline <type> <version>` goes in the template's notes only when it is pasted in the UI (Flow C); on a direct write put the line in the report.
- Then save through Flow C (a local versioned file for now, see #24), or a direct write if the user asked for one. A direct `create_template` / `update_template_content` follows the plan, never a blind create.

## Verify

- `restyle-report.md` has no unexplained `kept` or `skipped` line, and every `contrast-adjusted` line is reported to the user.
- The scope check passes on the final files: `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs check --html <htmlPath> --css <cssPath>` (wrapper class, every selector under it, `@keyframes` and `@font-face` names carrying it). The post-edit hook reports the same findings; for an existing client template, findings inherited from it are not yours to fix unless asked.
- No hardcoded colours or sizes outside the overrides block; text added in the overrides block is held to 4.5:1 too.
- The client font actually loads in the preview (a family the script marked "not verified" is assumed to be on Google Fonts; confirm it renders).
- Preview with the loop's mock ads, on the site's background. Check long text, missing optional fields, zero items, and widths from small mobile to TV (320, 768, 1280, 1920) with no horizontal scroll.
- Responsive CSS only takes effect on phones if the host page has a viewport meta tag. That is outside the template; mention it if mobile looks unchanged.
- Required markup from CHECKLIST is present; no 🔴 anti-pattern is triggered.
- If a live preview or a real-zone test was not possible, say so.

## Final report

Keep it short:
- Baseline used (type and version), network, and template or artifact result (version if saved, and the plan: create / patch / none)
- The token list from `restyle-report.md`: mapped, derived, kept (with the reason), contrast-adjusted, unmapped, skipped. Paste it, do not summarise it.
- Overrides added; any new token
- Structure or HTML changes (or none)
- Tracking: none added, preserved, or added as requested
- Verified and not verified
- Suggested baseline improvements, if any
