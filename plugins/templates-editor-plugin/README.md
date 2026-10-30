# templates-editor-plugin

Part of the [**lincx-marketplace**](../../README.md). See the marketplace README for install, usage, and development instructions — everything a user or contributor needs lives there.

## What this plugin is

Build and adjust Lincx ad templates (HTML + Mustache + CSS) from Claude Code with a live preview loop. Pulls via the Lincx MCP, renders a local preview after every edit, and produces a versioned save artifact (will push via MCP once the Lincx write tool ships).

## Commands, flow, and workflow

All covered in the [marketplace README](../../README.md#using-templates-editor-plugin).

## Playbook restyle (lincx-template-playbook)

The offer-wall and listicle baselines ship inside the playbook skill (`skills/lincx-template-playbook/references/baselines/<type>/`: html, css, the CAG fields it expects, mock ads and a hash-checked `SOURCE.md`), so starting from one needs no request to any Lincx network. Restyling a baseline is done by `scripts/restyle.mjs`, ported from lincx-site-fit: the model reads the publisher's site into a `site-tokens.json` (`skills/lincx-template-playbook/site-tokens.md`); the script validates it, maps it onto the baseline's tokens through `skills/lincx-template-playbook/adapters/<type>.json`, holds text to 4.5:1 contrast, picks and imports the font, refuses unsafe values and reports every decision. It also checks CSS scoping, detects walled sites, builds the deterministic template name and decides create / patch / none / stop on save. `node scripts/restyle.mjs` with no arguments lists the commands.

## Reference library

The LLM's authoring behavior is shaped by `references/`:
- `CHECKLIST.md` — production checklist
- `patterns.md` — copy-paste pattern snippets
- `anti-patterns.md` — severity-ordered don'ts
- `patterns/example-1/` … `patterns/example-8/` — real production templates with brief notes

Read `references/README.md` for the intended read order and the example-picker table.

## Tests

```
cd plugins/templates-editor-plugin
npm test
```

Runs unit tests (`node:test`), the hook shell-fixture, and the structural lint. No `npm install` needed — everything uses stdlib.
