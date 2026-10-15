# Baseline registry

Fill this in once per network. The playbook reads it to pick a baseline. Baselines are never edited in place; they are cloned per client.

| Type | Network ID | Baseline template ID | CAG ID | Notes |
|---|---|---|---|---|
| offer-wall | lvecuu | u1cfwr | oobfv2 | |
| listicle | lvecuu | u7clvm | 5kf3sq | |
| carousel | lvecuu | ts86dt | d452s5 | |

Listings baseline: removed for now. Until one is added, listings requests use the full path (`full-build.md`).

## Tokens: each baseline owns its own

There is no shared token list. Each baseline defines its own CSS variables in the token block of its own CSS. Follow the baseline in front of you:

1. Read the baseline's CSS and list the tokens it actually defines.
2. Restyle using only those tokens. Use the baseline's names exactly.
3. Do not invent new tokens, and do not assume names from another baseline or from this repo's earlier templates.
4. Add a new token only if the client needs something no existing token controls. Put it in the CLIENT OVERRIDES block of the client copy, and report it as a possible baseline improvement.
5. If a style value is hardcoded in the baseline (not behind a token), prefer a small override over rewriting the baseline rules, and mention it in the report.

## Maintenance rules

- Update a baseline only when explicitly asked, then record the new version here.
- When a client template reveals a general improvement, apply it to the baseline once, not per client.
- If a type is added (for example a lead form), add a row and a baseline.
