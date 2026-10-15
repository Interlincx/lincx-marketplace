---
name: lincx-template-playbook
description: Entry workflow for creating or restyling a Lincx client template. Baseline-first - clone the offer-wall, listicle or carousel baseline and restyle only through its own tokens; if no baseline fits, follow full-build.md. Use when asked to build, clone, restyle or set up a Lincx template for a client.
---

# Lincx Template Playbook

Routes client template work. This skill decides **what to start from** (a baseline, or scratch) and keeps changes minimal. The `editing-lincx-templates` skill decides **how to author**. Both apply.

Registry of baselines: `baselines.md` (offer-wall, listicle, carousel). Full from-scratch path: `full-build.md`.

## Relationship to editing-lincx-templates (read first)

- Follow that skill's consult-references rule. Its references under `${CLAUDE_PLUGIN_ROOT}/references/` (README, CHECKLIST, patterns, anti-patterns) are the authority for structure, class names, Mustache forms, data attributes, JS helpers, and required legal/tracking markup.
- The template's CAG is the authority for which fields exist and how they are spelled. Never invent fields.
- Use its session state (`./.lincx-session.json`), its preview loop (`${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs`), and its save flow (Flow C).
- Where this skill and that skill disagree on structure or required markup, that skill wins.
- Never ask the user to place files silently: ask for `htmlPath` and `cssPath`, as that skill requires.

## Ground rules

- Never edit a baseline in place. Baselines are cloned, not modified, unless the user explicitly asks to improve the baseline.
- Read full sources with `get_template` `part: 'html'` / `part: 'css'` before using them. Never work from an elided response. `part` refuses a field over 25k: if a baseline's html or css is that large, stop and report it instead of working from a partial copy.
- Do not change a CAG or a template's `creativeAssetGroupId`.
- Do not copy a reference page's branding, logos, images, or copy.
- Do only what was asked. No extra features, no redesign beyond the brief.
- Writing to Lincx directly (`create_template`, `update_template_content`) is live immediately on every zone using the template. Default to the session and Flow C; until #24 lands, Flow C only writes a versioned file to paste by hand, not to Lincx. Use direct writes only when the user explicitly asks for them in this session.
- Do not say "done" without stating what was verified, what was not, and what is affected.

## Route the request

| Request | Do |
|---|---|
| New client template matching offer-wall, listicle or carousel | Baseline flow below |
| No baseline fits (including listings, for now) | `full-build.md` (plugin Flow B) |
| Change an existing client template | Plugin Flow A, using the restyle rules below |
| Review or audit | Out of scope for this skill |

## Baseline flow

1. **Pick the type.** Match the request to one baseline in `baselines.md`. If two fit, pick the closest layout and say why. If none fit, go to `full-build.md`.
2. **Check the network.** The baselines live on the network in `baselines.md`. If the request names a different network, stop and ask. CAG IDs are likely network-scoped, so a clone cannot be assumed to work elsewhere.
3. **Ask once**, in one message, only for what is missing: `htmlPath` and `cssPath`, primary and accent colors, text and background colors, font family (and whether it is already loaded), spacing density, border radius, logo constraints. If the result will be created in Lincx as a new template, also `publisherId` and `name` (`create_template` requires both).
4. **Seed from the baseline.** Fetch the baseline's HTML and CSS, write them to the chosen paths, and create the session entry with `templateId: null`, the baseline's CAG ID, and its `cagSchema` (same as Flow B, pre-filled instead of empty). After any `create_template`, write the returned template id into that session entry so the hooks and Flow C keep tracking it.
5. **Consult the references.** A restyle-only change counts as trivially simple in the plugin skill: confirm it introduces no new tokens and re-read the anti-patterns 🔴 section. Structure changes need the full read.
6. **Restyle through the baseline's own tokens.** Read the baseline's token block, list the tokens that exist, and change those values with the baseline's exact names. Do not invent tokens or assume names from another baseline. Do not rewrite rules that existing tokens already control.
7. **Small adjustments go in an overrides block** at the end of the CSS: `/* CLIENT OVERRIDES: <client> */`. Keep it short. Leave the baseline rules above it untouched so the client copy can be diffed against the baseline later. Add a new token only if no existing one controls the need; put it in this block and report it.
8. **Structure changes are the exception.** Edit the HTML only when the client needs something the baseline lacks. Follow the matching pattern, keep the required markup (`data-lincx-cta`, legal disclosures, anything CHECKLIST marks MUST), and list every change in the report.
9. **Tracking.** Adding `clickToCallEvent` or other event code is opt-in: only for elements and event names the user explicitly requests. Required plugin markup is not optional and is never removed. If the baseline already has tracking, keep it. Never copy event IDs or unit IDs to another client without confirming the right ones.
10. **Flag general gaps.** If a missing thing would help every client (a bug, a missing breakpoint, a missing optional field), finish the client task, then report it as a suggested baseline improvement. Do not silently fork it.
11. **Preview and verify** with the plugin's preview loop (see Verify). Then save through Flow C (a local versioned file for now, see #24), or a direct write if the user asked for one.
12. **Stop** when the restyled clone works.

## Verify

- Tokens changed correctly; no hardcoded colors or sizes introduced outside the overrides block.
- Text on primary and accent colors is readable; the client font actually loads.
- Preview with the loop's mock ads. Check long text, missing optional fields, zero items, and widths from small mobile to TV (320, 768, 1280, 1920) with no horizontal scroll.
- Responsive CSS only takes effect on phones if the host page has a viewport meta tag. That is outside the template; mention it if mobile looks unchanged.
- Required markup from CHECKLIST is present; no 🔴 anti-pattern is triggered.
- If a live preview or a real-zone test was not possible, say so.

## Final report

Keep it short:
- Baseline used, network, and template or artifact result (version if saved)
- Tokens changed and overrides added; any new token
- Structure or HTML changes (or none)
- Tracking: none added, preserved, or added as requested
- Verified and not verified
- Suggested baseline improvements, if any
