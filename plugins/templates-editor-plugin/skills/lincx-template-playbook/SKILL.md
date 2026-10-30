---
name: lincx-template-playbook
description: Entry workflow for creating or restyling a Lincx client template. Baseline-first - copy the bundled offer-wall or listicle baseline and restyle only through its own tokens, reading the publisher's site from a URL when one is given; if no baseline fits, follow full-build.md. Use when asked to build, clone, restyle or set up a Lincx template for a client.
---

# Lincx Template Playbook

Routes client template work. This skill decides **what to start from** (a baseline, or scratch) and keeps changes minimal. The `editing-lincx-templates` skill decides **how to author**. Both apply.

Registry of baselines: `baselines.md` (offer-wall and listicle are bundled under `references/baselines/`; carousel is not), with a token mapping per baseline in `adapters/`. The baselines ship with this skill: starting from one makes no request to any Lincx network. Full from-scratch path: `full-build.md`.

The restyle itself is done by `${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs`, not by hand: you read the site into a `site-tokens.json`; the script validates it, maps it onto the baseline's tokens, fixes contrast, loads the font and reports every decision. Same site, same baseline, same CSS. This mirrors how lincx-site-fit works.

## Relationship to editing-lincx-templates (read first)

- Follow that skill's consult-references rule. Its references under `${CLAUDE_PLUGIN_ROOT}/references/` (README, CHECKLIST, patterns, anti-patterns) are the authority for structure, class names, Mustache forms, data attributes, JS helpers, and required legal/tracking markup.
- The template's CAG is the authority for which fields exist and how they are spelled. Never invent fields.
- Use its session state (`./.lincx-session.json`), its preview loop (`${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs`), and its save flow (Flow C).
- Where this skill and that skill disagree on structure or required markup, that skill wins.
- Never ask the user to place files silently: ask for `htmlPath` and `cssPath`, as that skill requires.

## Ground rules

- Never edit a baseline in place. Baselines are copied, not modified, unless the user explicitly asks to improve the baseline (then it is a new version with new hashes, see `baselines.md`).
- Read a baseline from this skill's `references/baselines/<type>/`, never from a network: do not call `get_template` for a baseline. Read an existing client template in full with `get_template` `part: 'html'` / `part: 'css'` before changing it, and never work from an elided response. `part` refuses a field over 25k: if the client's html or css is that large, stop and report it instead of working from a partial copy.
- Do not change a CAG or a template's `creativeAssetGroupId`.
- Do not copy a reference page's branding, logos, images, or copy.
- Do only what was asked. No extra features, no redesign beyond the brief.
- Writing to Lincx directly (`create_template`, `update_template_content`) is live immediately on every zone using the template. Default to the session and Flow C; until #24 lands, Flow C only writes a versioned file to paste by hand, not to Lincx. Use direct writes only when the user explicitly asks for them in this session.
- Never read tokens from a walled site (challenge page, HTTP 4xx/5xx, nearly empty page). Run the `wall` check, and if it says walled, stop guessing and ask for the values.
- Never type a token value into the CSS that the script did not produce, except in the CLIENT OVERRIDES block. A value that contains `; { } < > \\ /* */`, a line break or unbalanced quotes is refused by the script; do not work around it.
- Do not say "done" without stating what was verified, what was not, and what is affected.

## Route the request

| Request | Do |
|---|---|
| New client template matching offer-wall or listicle | Baseline flow below |
| No baseline fits (including carousel and listings, for now) | `full-build.md` (plugin Flow B) |
| Change an existing client template | Plugin Flow A, using the restyle rules below |
| Review or audit | Out of scope for this skill |

## Baseline flow

1. **Pick the type.** Match the request to one baseline in `baselines.md`. If two fit, pick the closest layout and say why. If none fit, go to `full-build.md`.
2. **Check the baseline is bundled.** Only offer-wall and listicle are (`baselines.md`). For anything else go to `full-build.md`. Nothing is fetched from a network at this step.
3. **Collect the site tokens.** Do not ask for colours and fonts the site already shows.
   - **Publisher URL given:** load the page (browser or fetch) and run the wall check: `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs wall --probe probe.json` with `{ status, title, html, visibleTextLength }`. If walled, stop and ask for the values (below). Otherwise read the visible page and write `site-tokens.json` (shape in `site-tokens.md`): body and heading font, text, background, heading, link and accent colours, CTA (background, text, radius, weight, transform, padding, label), radius, spacing, content width. Every group carries `confidence` (`high` only for what you measured on the rendered page: computed styles, not guesses from the class names; `low` for a guess; `missing` for nothing found, with null values) and a `source`.
   - **No URL, or walled:** ask once, in one message, only for what is missing, and record the answers as `confidence: high`, `source: "user"`.
   - Then ask only about groups that are `low` or `missing` and matter for this baseline (the adapter tells you which tokens read them).
   - Also ask, in the same message, only for what is still missing: `htmlPath` and `cssPath`, spacing density, logo constraints. If the result will be created in Lincx as a new template, also `publisherId` and `name` (`create_template` requires both).
4. **Seed from the baseline.** Copy the bundled files with `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs baseline --type <type> --dir <folder>`: `template.html`, `styles.css`, `mock-ads.json` and `cag-schema.json` land in `<folder>`; use the chosen `htmlPath` and `cssPath` as the working copies. Pick the client's CAG per `baselines.md` ("The CAG a new template needs"): ask for the id, read it with `get_creative_asset_group` and run `restyle.mjs cag-check`; stop on `ok: false`. Create the session entry with `templateId: null`, that CAG id, `cagSchema` from `cag-schema.json`, and `mockAds` from `mock-ads.json` (`.ads`) when no real zone ads are loaded. Set `hostBackground` on the entry to the site's `colorBackground` so the preview paints on the publisher's page. After any `create_template`, write the returned template id into that session entry so the hooks and Flow C keep tracking it.
5. **Consult the references.** A restyle-only change counts as trivially simple in the plugin skill: confirm it introduces no new tokens and re-read the anti-patterns 🔴 section. Structure changes need the full read.
6. **Restyle through the script.**
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs restyle --baseline <type> --tokens site-tokens.json --css <cssPath> --out <cssPath> --report restyle-report.md`
   - It maps only high-confidence values; `low` and `missing` keep the baseline value and say so.
   - Text on a mapped colour is held to 4.5:1 and flipped to black or white when it is not.
   - Fonts: licensed families get a stand-in (Gotham → Montserrat, Proxima Nova → Montserrat, Avenir → Nunito Sans, …); the one Google Fonts `@import` carries only the weights the token block uses.
   - **If the report lists `skipped … not in this baseline's token block`, the adapter and the bundled baseline have drifted (one of them was edited).** Say so, do not claim a full restyle, and fix the adapter in a follow-up (see `baselines.md`).
   - **No adapter for the baseline** (none today): read the baseline's token block, list its tokens, restyle those with their exact names by hand, and put the proposed mapping in your report so it can become an adapter. Contrast and the scope check still apply.
   - Never edit a baseline CSS rule when a token controls it.
7. **Small adjustments go in an overrides block** at the end of the CSS: `/* CLIENT OVERRIDES: <client> */`. Keep it short. Leave the baseline rules above it untouched so the client copy can be diffed against the baseline later. Add a new token only if no existing one controls the need; put it in this block and report it.
8. **Structure changes are the exception.** Edit the HTML only when the client needs something the baseline lacks. Follow the matching pattern, keep the required markup (`data-lincx-cta`, legal disclosures, anything CHECKLIST marks MUST), and list every change in the report.
9. **Tracking.** Adding `clickToCallEvent` or other event code is opt-in: only for elements and event names the user explicitly requests. Required plugin markup is not optional and is never removed. If the baseline already has tracking, keep it. Never copy event IDs or unit IDs to another client without confirming the right ones.
10. **Flag general gaps.** If a missing thing would help every client (a bug, a missing breakpoint, a missing optional field), finish the client task, then report it as a suggested baseline improvement. Do not silently fork it.
11. **Preview and verify** with the plugin's preview loop (see Verify).
12. **Save by name.** The template name is deterministic, so a re-run updates the same template instead of making a duplicate:
    - `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs name --prefix "<prefix>" --client <network id> --url <site url> --widget <type> --version <baseline version>`
    - Look it up with `list_templates` (the publisher, in the network) and read the match in full with `get_template`. Write `{ name, html, css, creativeAssetGroupId }` and the matches to files and run `restyle.mjs plan-save --existing <file> --desired <file>`.
    - `create`: a new template. `patch`: same html and CAG, new css: update it. `none`: nothing changed. `stop`: duplicate names or drift (the html or CAG no longer matches the baseline copy); do not write, tell the user.
    - A new template adds the history line `[Auto - system generated] Created from bundled baseline <type> <version>`, and sets `tieringEnabled: false`.
    - Then save through Flow C (a local versioned file for now, see #24), or a direct write if the user asked for one. A direct `create_template` / `update_template_content` follows the plan, never a blind create.
13. **Stop** when the restyled copy works.

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
