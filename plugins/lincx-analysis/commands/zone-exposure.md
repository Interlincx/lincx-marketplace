---
description: Diagnose a Lincx zone's exposure over a date range — which eligible offers surfaced, at what ranks, which are pinned or crowded out, and what the scoring probe says today
argument-hint: "[zoneId] [dateStart] [dateEnd] [adGroupId|adId ...] [geoState] [geoPostal]"
---

Invoke the `zone-exposure` skill with arguments `{{args}}`.

Argument parsing:
- The first token matching `^[a-z0-9]{6}$` is the **zoneId**. Any further such
  tokens are **target ad group / ad ids** the user is asking about (the skill
  tells them apart from the exposure rows).
- Tokens matching `^\d{4}-\d{2}-\d{2}$` are **dateStart** then **dateEnd**, in
  that order.
- A token matching `^[A-Z]{2}$` is **geoState**; one matching `^\d{5}$` is
  **geoPostal** — both go to `get_zone_candidates`.
- Missing zoneId → ask for it. Missing date range → ask for it. Never default a range.

Then follow the skill's flow exactly.
