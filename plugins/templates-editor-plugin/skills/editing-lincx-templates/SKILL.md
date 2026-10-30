---
name: editing-lincx-templates
description: Build and adjust Lincx ad templates (HTML+CSS). Use when the user asks to create, modify, or preview a Lincx template, or when a slash command in the `/lincx-template-*` family is invoked.
---

# Editing Lincx Templates

You help users author and adjust Lincx ad creative templates (HTML + CSS) bound to a `creativeAssetGroup` (CAG) schema. You work with the `lincx-mcp` for reads (template, CAG, zone ads) and cache results into `./.lincx-session.json` so a local preview loop runs automatically on every edit.

## Consult-references rule (MANDATORY before authoring)

**Two sources of truth, split by role:**
- **The references under `${CLAUDE_PLUGIN_ROOT}/references/`** are the authority for **structure, conventions, class names, Mustache forms, data attributes, JS helpers, and required legal/tracking markup**.
- **The CAG (`creativeAssetGroup`) for the specific template you're working on** is the authority for **which fields exist, their types, and their spelling**. The CAG is loaded per session via `get_creative_asset_group(id=…)` in Flow A below, and cached in session state as `cagSchema`.

Never confuse the two. A field that appears in an example under `patterns/example-N/` does NOT mean that field exists on the template you're editing. Every CAG is its own contract.

Before proposing any template HTML or CSS, read the references **in this order**:

1. `${CLAUDE_PLUGIN_ROOT}/references/README.md` — the read-order overview and the example-picker table.
2. `${CLAUDE_PLUGIN_ROOT}/references/CHECKLIST.md` — the deterministic production checklist. Every item is a MUST unless marked OPTIONAL. §6 is critical: it explains that fields come from the CAG, not from any universal catalog.
3. `${CLAUDE_PLUGIN_ROOT}/references/patterns.md` — copy-paste-ready snippets. Jump to the section(s) matching the user's intent (listicle, sticky bar, product card, multi-CTA, rating, video, footer, etc.). Remember: the field names in snippets are illustrative — swap them for the CAG's field names.
4. `${CLAUDE_PLUGIN_ROOT}/references/anti-patterns.md` — must-not-do list. At minimum, re-read the 🔴 production-breaking section every session. Re-check the matching entry before doing anything that *could* be an anti-pattern.
5. The relevant `${CLAUDE_PLUGIN_ROOT}/references/patterns/example-N/` directory — real production template + stylesheet + a brief `notes.md`. Use the picker table in `references/README.md` to choose the example that matches the brief. **Copy the structure; don't copy the field names.**

Then:

- If the request is covered by a pattern / example, **follow the pattern's structure exactly**, substituting this template's CAG field names wherever tokens appear.
- **Only deviate structurally** when the request isn't covered by any pattern, or is trivially simple (change a color, fix a typo, adjust padding).
- When deviating, state in one sentence which pattern/example the work is closest to and why you're not following it exactly.
- Never invent field names, never use a field the CAG doesn't define, never skip `data-lincx-cta`, never drop legal disclosure blocks.

Depth of consultation:
- **Trivially simple**: confirm the change doesn't introduce new tokens; re-read `anti-patterns.md` 🔴 section; touch the code. Skip the rest.
- **Anything else**: full read of the five items above + the CAG schema before touching code.

## Session state

Single source of truth: `./.lincx-session.json` in the user's current working directory. Shape:

```json
{
  "previewDisabled": false,
  "activeTemplates": [
    {
      "id": "<stable id, e.g. entry-1>",
      "templateId": "<string or null>",
      "creativeAssetGroupId": "<string>",
      "htmlPath": "<user-chosen path>",
      "cssPath": "<user-chosen path>",
      "previewPath": "<typically sibling preview.html>",
      "version": "<number or null>",
      "dirty": false,
      "cagSchema": { "fields": [ ... ] },
      "mockAdsSource": {
        "kind": "zone-resolved | zone | synthesized | synthesized-fallback",
        "zoneId": "<string or null>",
        "warnings": ["..."]
      },
      "mockAds": []
    }
  ]
}
```

Use `${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs` (`readSessionState`, `writeSessionState`, `upsertEntry`, `removeEntry`, `findEntryByPath`) via a small inline `node --input-type=module -e ...` invocation. Do not hand-parse the file.

## Flows

### Flow A — Build from scratch (from `/lincx-template-new <name>`)

1. `auth_status`.
2. `list_creative_asset_groups` → ask the user to pick a CAG. Record `creativeAssetGroupId`.
3. Ask for `htmlPath` and `cssPath`. Create empty files at those paths.
4. `get_creative_asset_group(id=<chosen>)` → cache `cagSchema`.
5. Upsert entry with `templateId:null`.
6. Consult references per the mandatory rule, ask a few shaping questions (layout family, purpose, constraints), then author initial HTML/CSS. Mark `dirty:true`.
7. Live-preview loop: every Edit/Write re-renders silently using the cached `mockAds`.

### Flow B — Load ads (from `/lincx-template-load-ads <zoneId>`)

1. Identify the target entry (ask if > 1 active).
2. `get_zone_ads(id=<zoneId>)`.
3. Update entry: `mockAds: <returned>`, `mockAdsSource: { kind:"zone", zoneId }`.
4. Dispatch renderer so preview refreshes.

### Flow C — Preview toggle (from `/lincx-template-preview-toggle`)

1. Flip `previewDisabled` in session state.
2. Report new state.

## Never do

- Never render or open browsers yourself. The renderer does that.
- Never invent pattern conventions. The references are the source of truth.
- Never silently default path choices. Ask the user.
- Never push to Lincx unless the user asked for a direct write. Writes go through the registered MCP template tools (the write guard asks first). No HTTP calls, no CLI shell-outs.

## On failure

- Auth missing → stop, ask for login, do not create session state.
- MCP call errors → surface inline; do not mutate session state.
- Corrupt session state → offer to archive as `.lincx-session.json.bak` and start fresh.
- Renderer or hook errors → check `./.lincx-session.log`.
