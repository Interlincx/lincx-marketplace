# site-tokens.json

What you write after reading a publisher's site, and what `scripts/restyle.mjs` validates before it maps anything. Same shape as lincx-site-fit's site tokens.

Every group below is an object with `confidence` (`high` | `low` | `missing`), `source` (a short note on where you read it, e.g. `computed style of the first <p>`; `null` only when `missing`) and its own fields. A `missing` group has `null` for every field.

| Group | Fields | Read it from |
|---|---|---|
| `fontBody` | `family`, `sizePx`, `lineHeight` (unitless) | computed style of the main article/body paragraph, not nav or footer |
| `fontHeading` | `family`, `weight` | the page's main heading (h1/h2) in the content area |
| `colorText` | `value` `#rrggbb` | body paragraph colour |
| `colorBackground` | `value` | the page background behind the content (body, then html) |
| `colorHeading` | `value` | main heading colour |
| `colorLink` | `value` | in-content link colour |
| `colorAccent` | `value` | the brand accent: the most used filled non-neutral colour (buttons, bars) |
| `cta` | `background`, `text`, `radiusPx`, `fontWeight`, `textTransform` (`none`/`uppercase`/`lowercase`/`capitalize`), `paddingYPx`, `paddingXPx`, `label` | the page's primary call-to-action button, not a cookie or consent button |
| `radiusPx` | `value` | most common card/box corner radius |
| `spacingUnitPx` | `value` | base spacing step |
| `contentMaxWidthPx` | `value` | max width of the article column |

Rules:
- Colours are `#rrggbb` (convert `rgb()`, named and short hex). Numbers are plain numbers.
- `high` only for values you measured on the rendered page. A guess is `low`. Nothing found is `missing`. Never invent a value to avoid `missing`.
- Ignore consent banners, cookie dialogs and chat widgets when picking colours and the CTA.
- The family is the CSS family name (`Source Sans 3`), not the whole stack.
- Which groups a baseline actually reads is in its adapter (`adapters/<type>.json`, the `from` of each token). Groups it does not read still need to be present (as `missing` if unknown).

Minimal example:

```json
{
  "fontBody": { "confidence": "high", "source": "p.article-body", "family": "Source Sans 3", "sizePx": 17, "lineHeight": 1.6 },
  "fontHeading": { "confidence": "low", "source": "guessed from h1", "family": "Gotham", "weight": 700 },
  "colorAccent": { "confidence": "missing", "source": null, "value": null }
}
```

(The real file lists all eleven groups; see `tests/fixtures/restyle/site-tokens-good.json`.)
