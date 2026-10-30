# listicle v1 — bundled baseline

Read by the playbook instead of cloning a template from a network. Do not edit these files in place; a change is a new version (see `baselines.md`).

- Origin: lincx-site-fit `starters/listicle/v1` (site-fit `fee4776`), which is adverse-static #4017 `app/starter-templates/listicle-standard/` at `8b1fbf92`, prepped for site-fit (every selector under `.lincx-wrapper`, zone-scoped scripts, a `--lstcl-*` token block). Its own `SOURCE.md` there has the full prep list.
- Wrapper class: `.lincx-wrapper`. Look: no intended look difference from the raw starter.
- `cag.json` is the CAG field set the template expects (`fieldsOrder` and `fields`), verbatim from site-fit's `adapter.json` `cagSchema`. `mock-ads.json` is the starter's mock ads for the preview.
- Not yet compared byte for byte with the template of the same type on the demo network (`baselines.md`, "Network copies"): site-fit's copy and that one may differ.

Hashes (sha256, checked by `tests/baselines.test.mjs`):

- `template.html` sha256 `5c4651dad9d1ffa4df573f78e4a5f6264febf43bf865e01141e9c48bcf08beac`
- `styles.css` sha256 `d9bfea73ae04d364b0c60db3333a1163ec8fefacc3934b1084dbca168e908873`
- `cag.json` sha256 `383fac7e1dc0ceb775fe401e2d3ed07e59bf22ef7aebe8639e103838f4cba414`
- `mock-ads.json` sha256 `7f2e90b63e0dc218b7df7fa1d1b3d0340bd4c4379167055529519111cf5f684b`
