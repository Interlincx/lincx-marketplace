# offer-wall v1 — bundled baseline

Read by the playbook instead of cloning a template from a network. Do not edit these files in place; a change is a new version (see `baselines.md`).

- Origin: lincx-site-fit `starters/offer-wall/v1` (site-fit `fee4776`), which is adverse-static #4017 `app/starter-templates/offer-wall/` at `8b1fbf92`, prepped for site-fit (every selector under `.listing-wrapper`, a `--ow-*` token block holding each look literal). Its own `SOURCE.md` there has the full prep list.
- Wrapper class: `.listing-wrapper`. Look: offer-wall v1 — the prepped baseline's look differs from the raw production template only by the two items in site-fit's `prep-allowlist.json`.
- `cag.json` is the CAG field set the template expects (`fieldsOrder` and `fields`), verbatim from site-fit's `adapter.json` `cagSchema`. `mock-ads.json` is the starter's mock ads for the preview.
- Not yet compared byte for byte with the template of the same type on the demo network (`baselines.md`, "Network copies"): site-fit's copy and that one may differ.

Hashes (sha256, checked by `tests/baselines.test.mjs`):

- `template.html` sha256 `208cf10f8a4f4204e636b24bd432d25354dd708b6f471664bd4a037b673b6c9b`
- `styles.css` sha256 `fea3cdede8203031db7237acac3d49778e18578e625b02eb451aff16eb11ff57`
- `cag.json` sha256 `6d2ba54865cd3e86c6b2bcf8b98f0947a7978911deb4b91fe9e8466c4035767e`
- `mock-ads.json` sha256 `7a5d60067fba87b86d63a8743f63c97c6f22bea30239974d7554c5fbd385956c`
