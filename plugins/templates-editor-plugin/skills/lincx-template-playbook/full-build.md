# Full build (no baseline fits)

Use when no baseline matches, or the user asks for something new. This follows the plugin's Flow B (build from scratch). The `editing-lincx-templates` references and the CAG remain the authority for structure and fields.

## 1. Analyze the input

1. Identify the repeating unit (card, form step, banner) and the page-level pieces around it.
2. List its parts; mark each fixed or variable per item.
3. Note layout changes across desktop, tablet, mobile, and the states: highlighted variants, missing fields, long text, zero items.
4. If there is no reference, list the parts from the request and ask one short question about anything ambiguous.
5. Do not copy a reference's branding, logos, images, or copy.

## 2. Resolve the CAG

Do not create a CAG by default. CAGs are reusable schemas shared by many templates.

1. List and read the CAGs on the target network. Check which CAG similar templates use.
2. Map each variable part to an existing field. Reuse the CAG if it covers the required fields; use `{{#field}}` / `{{^field}}` fallbacks for optional ones.
3. If an essential field is missing, or the data model truly differs, ask before extending or creating a CAG (every template and zone using it is affected).
4. Report which CAG was reused and what was mapped or missing.

## 3. Author

- Consult the plugin references in order before writing (README, CHECKLIST, patterns, anti-patterns, matching example). Follow the closest pattern; state which one and why you deviate, if you do.
- Use the CAG's field names, balanced Mustache sections, handled empty states, semantic markup, and alt text.
- Tracking (`clickToCallEvent` and similar) only when requested. Required plugin markup always stays.

## 4. CSS

- One token block at the top, scoped to the template container, and every rule uses `var(--...)`.
- Fluid sizing with `clamp()`, mobile-first. Scope selectors under the container. Use `box-sizing: border-box`, `min-width: 0` on flex children, `overflow-wrap: anywhere` on long text, `max-width: 100%` on images.
- Default breakpoints (unless the references say otherwise), reassigning tokens only: 2200px+, 1600-2199px, base, up to 900px, 600px, 400px, 340px.
- Load only the fonts used.

## 5. Preview, verify, save

Use the plugin's preview loop and Flow C. Verify as in `SKILL.md`. Name the template clearly and fill in notes (objectives, key features). Record that a new baseline candidate exists if the result is reusable.
