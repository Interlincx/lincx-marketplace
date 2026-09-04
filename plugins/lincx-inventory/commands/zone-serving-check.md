---
description: Which ads actually serve in a Lincx zone right now for a given visitor geo, and why a specific offer is or isn't in the pool — the geo- and time-aware get_zone_ads debug procedure
argument-hint: "[zoneId] [adGroupId] [geoState] [geoPostal]"
---

Invoke the `zone-serving-check` skill with arguments `{{args}}`.

Argument parsing:
- First token matching `^[a-z0-9]{6}$` is the **zoneId**; a second such token is the
  **adGroupId** (optional — omit to list the pool without a target offer).
- A token matching `^[A-Z]{2}$` is **geoState**; one matching `^\d{5}$` is **geoPostal**.
- If no zoneId is given, reuse the last remembered zone: run
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs get`. If empty, ask for one.
- When a zoneId is given, remember it:
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-state.mjs set <zoneId>`.
- If no geo is given, do NOT call debug without it (Rule 1). If an adGroupId is
  given, read its `geo[]` and pick an in-list state; otherwise ask for a geo.

Then follow the skill's flow exactly.
