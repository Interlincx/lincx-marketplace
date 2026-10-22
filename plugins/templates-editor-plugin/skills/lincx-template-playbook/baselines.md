# Baseline registry

Fill this in once per network. The playbook reads it to pick a baseline. Baselines are never edited in place; they are cloned per client.

| Type | Version | Network ID | Baseline template ID | CAG ID | Adapter | Notes |
|---|---|---|---|---|---|---|
| offer-wall | v1 | lvecuu | u1cfwr | oobfv2 | `adapters/offer-wall.json` | adapter from site-fit; not yet verified against this template |
| listicle | v1 | lvecuu | u7clvm | 5kf3sq | `adapters/listicle.json` | adapter from site-fit; not yet verified against this template |
| carousel | v1 | lvecuu | ts86dt | d452s5 | none | no site-fit starter; restyle by hand from its token block |

Listings baseline: removed for now. Until one is added, listings requests use the full path (`full-build.md`).

## Where the baselines come from

Two copies exist today: lincx-site-fit's starters (`starters/<type>/v1` in `Interlincx/lincx-site-fit`, each with a `SOURCE.md` giving its origin and file hashes, and a test that the prepped baseline renders like the raw one except for an allowlist) and the templates above on the demo-lvecuu network, which are the ones this playbook clones. The plan is one source, site-fit; until it serves its starters from an endpoint the MCP can read, this playbook keeps cloning the network copies.

`adapters/` holds, per baseline: `<type>.json` (the token mapping, copied from site-fit's `adapter.json` at `fee4776`: wrapper class, CAG fields, and for each baseline token which site token feeds it, plus `on` (the background it is held to 4.5:1 against) and `derive`) and `<type>.mock.json` (the starter's mock ads for the preview).

**The adapters come from site-fit's starters, not from the network templates above.** The two copies are not proven identical (site-fit's demo client uses other template and CAG IDs). The script therefore skips, and the report names, any adapter token the fetched baseline does not declare; it never invents one. When that happens, fix the adapter (or the baseline) and set `"verified": true` in the adapter once a restyle of the network template reports no skipped tokens.

Versioning: a baseline has a version (`v1`). Changing a baseline in Lincx means a new version row here, a matching adapter, and the version goes into every template name made from it (`restyle.mjs name`).

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
