# Baseline registry

The playbook reads a baseline from this skill's own folder. No network request is needed to pick, read or restyle one, so it works for clients who cannot see any Lincx demo network. Baselines are never edited in place; they are copied per client.

| Type | Version | Bundled in | Adapter | Notes |
|---|---|---|---|---|
| offer-wall | v1 | `references/baselines/offer-wall/` | `adapters/offer-wall.json` | adapter and files from site-fit; not yet compared with the demo-network copy |
| listicle | v1 | `references/baselines/listicle/` | `adapters/listicle.json` | adapter and files from site-fit; not yet compared with the demo-network copy |
| carousel | v1 | not bundled | none | no site-fit starter; its html and css exist only on the demo network. Carousel requests use `full-build.md` until it is exported |

Listings baseline: removed for now. Until one is added, listings requests use the full path (`full-build.md`).

Each bundled folder holds `template.html`, `styles.css`, `cag.json` (the fields the template expects), `mock-ads.json` (the preview's ads) and `SOURCE.md` (origin, version, sha256 of each file). `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs baseline --type <type> --dir <dir>` copies them to your working folder, with `cag-schema.json` in the session's shape.

## Where the baselines come from

The files come from lincx-site-fit's starters (`starters/<type>/v1` in `Interlincx/lincx-site-fit`, copied at `fee4776`), which carry the provenance and a test that the prepped baseline renders like the raw one except for an allowlist. The plan is still one source, site-fit; when it serves its starters from an endpoint, the bundled copies can be refreshed from there (new version, new hashes).

`adapters/` holds, per baseline, `<type>.json`: the token mapping, copied from site-fit's `adapter.json` at `fee4776` (wrapper class, CAG fields, and for each baseline token which site token feeds it, plus `on`, the background it is held to 4.5:1 against, and `derive`).

The adapter and the bundled files come from the same starter, so they match. The script still skips, and the report names, any adapter token the baseline's CSS does not declare; it never invents one. Set `"verified": true` in the adapter once a restyle of the bundled baseline reports no skipped tokens and the result has rendered in a preview.

Versioning: a baseline has a version (`v1`). Changing a baseline means a new version row here, new files with new hashes in its `SOURCE.md`, a matching adapter, and the version goes into every template name made from it (`restyle.mjs name`).

## The CAG a new template needs

A template is tied to a CAG on the client's own network. `cag.json` lists the fields the baseline expects. Ask the user for the CAG id they want to use, read it with `get_creative_asset_group`, write it to a file and run `restyle.mjs cag-check --type <type> --cag <file>`. `ok: false` (missing or retyped fields) means the template would render with holes: stop and tell the user which fields. Extra fields are harmless. If the client has no matching CAG, say so; creating one from `cag.json` needs the CAG creation tool (lincx-mcp#89, not shipped yet), so until then the user creates it.

## Network copies (reference only)

The same baselines were first cloned from templates on the demo network. The playbook never reads them. They stay listed so the write guard still asks before anything edits them:

| Type | Network ID | Baseline template ID | CAG ID |
|---|---|---|---|
| offer-wall | lvecuu | u1cfwr | oobfv2 |
| listicle | lvecuu | u7clvm | 5kf3sq |
| carousel | lvecuu | ts86dt | d452s5 |

## Tokens: each baseline owns its own

There is no shared token list. Each baseline defines its own CSS variables in the token block of its own CSS, and its adapter says which site value feeds which one. Follow the baseline in front of you:

1. Read the baseline's CSS and list the tokens it actually defines.
2. Restyle using only those tokens. Use the baseline's names exactly.
3. Do not invent new tokens, and do not assume names from another baseline or from this repo's earlier templates.
4. Add a new token only if the client needs something no existing token controls. Put it in the CLIENT OVERRIDES block of the client copy, and report it as a possible baseline improvement.
5. If a style value is hardcoded in the baseline (not behind a token), prefer a small override over rewriting the baseline rules, and mention it in the report.

## Maintenance rules

- Update a baseline only when explicitly asked, then record the new version here.
- When a client template reveals a general improvement, apply it to the baseline once, not per client.
- If a type is added (for example a lead form), add a row and a baseline.
