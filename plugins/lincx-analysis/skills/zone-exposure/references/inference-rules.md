# Inference rules — the only heuristics this skill may apply

The tools return `observed` and `derived` fields. Everything below is
`[inferred]`: a heuristic with a stated threshold, applied to those fields.
Every sentence produced by a rule here carries the `[inferred]` label, and
names the rule's inputs in the same sentence so the reader can re-run it.

These rules exist here and nowhere else. A tool has no field for "crowded out"
or "in explore", so a tool cannot say it by accident. You can. Label it.

---

## R1 — Explore / exploit read (A2)

**Inputs** (all from `get_zone_candidates`): the scored candidates — those with
a numeric `score` — and their `impressions`. Unscored candidates (`score:
null`) are excluded; they are unranked, not ranked last.

**Derived first** (label `[derived]`, state the numbers):
- `median_score` and `median_impressions` across the scored set.
- Per candidate: `score` relative to `median_score`, `impressions` relative to
  `median_impressions`.

**Then the read** (label `[inferred]`):

| `impressions` vs median | `score` vs median | Read |
|---|---|---|
| below | at or above | *explore* — the scorer is still buying confidence on an offer that scores well on a thin base |
| below | below | *explore, unpromising* — thin base and a weak score; the next impressions decide it |
| at or above | at or above | *exploit* — established and winning |
| at or above | below | *exploited and fading* — a large base has not lifted the score |

State it as: *"[inferred] `pie2dt` reads as explore: 1,144 impressions against
a candidate median of 1,600, score 1.649 against a median of 0.98."*

**What this rule cannot say:**
- the scoring window — `impressions` is a trailing count of unknown width;
- the weighting function — there is no `explore` flag and no confidence term
  in the payload;
- *why* one candidate outscored another — `score` is not a monotone function
  of the visible `cpm` (`sg1rot` 1.449 at `cpm: 0` vs `pie2dt` 1.649 at
  `cpm: 87.34` on the fixture zone). The component breakdown is not returned.
  Never write "because its CPM is higher".

If fewer than 4 candidates are scored, the medians are not meaningful; skip R1
and say why.

---

## R2 — Crowd-out read (B1 / B2)

An offer is **crowded out** when it is eligible and live, took no delivery in
the window, and the slots it could have taken are accounted for by config or
by higher-scoring candidates. The join cannot assert this — there is no
opportunity denominator, so `unknown` is what the tool emits — and neither can
you, but you may rank the `unknown` rows by how much of the explanation is
visible. Three tiers, most explained first:

**R2a — pinned out** `[inferred]`. Preconditions, all observed:
- row `status: 'unknown'`;
- `placement.forcedAdPositions` plus `placement.forcedAdGroups` together pin
  **≥ 50 % of `placement.adFeedCount`** server slots (`[derived]`: count of
  distinct pinned slots ÷ `adFeedCount`), or `segments_carry_forced_order` is
  true and a segment that itself carries a forced order (non-empty
  `forcedAdPositions` or `forcedAdGroups`) has `trafficAllocation ≥ 50`;
- the offer itself has `forced: null` (it holds no pin).

Read: *"[inferred] `<ad>` is likely pinned out: config fixes N of M server
slots (`[derived]` N ÷ M), the offer holds none of them, and it took no
delivery."* When the pins come from a segment, say the share: *"a segment at
50 % traffic runs its own forced order, so half of requests never reach the
auction for this offer."*

**R2b — outscored** `[inferred]`. Preconditions:
- row `status: 'unknown'`;
- the offer **appears** in `candidates[]` with a numeric `score`;
- at least 4 candidates are scored (same guard as R1 — a bottom third of
  three is one offer, not a tier);
- its `score` is in the **bottom third** of the scored candidates
  (`[derived]`: rank by score, state the position and `score_min`/`score_max`);
- `candidates_returned` exceeds `placement.adFeedCount`, i.e. more candidates
  than slots (`[derived]`).

Read: *"[inferred] `<ad>` is likely outscored on today's probe: 19th of 22
scored candidates against 10 slots."* This is a read of **now** applied to a
window in the **past**; say that in the same sentence or the next.

**R2c — not explained** — no `[inferred]` sentence. The row is `unknown` and
either it is absent from `candidates[]`, or it is present with a mid-to-upper
score, or the zone has no pins and fewer candidates than slots. Report it as
`[observed] status unknown` and list what you checked. Absence from the
candidate list is **not** rejection: the rejected set and the stage each
candidate dropped at are not in the payload.

**Never** promote an `unknown` row to "eligible and never surfaced" through R2.
`eligible-never-surfaced` is emitted by the tool in exactly one derivable case
(a zone-level pin on every request, traffic in the window, zero delivery).
If the tool did not say it, you do not.

---

## R3 — Tail placement read (A1)

For a `serving` row with a non-empty `rank_histogram`:

- `[derived]` share of impressions at visual rank ≥ 4:
  Σ(rank ≥ 4) ÷ Σ(all ranks).
- `[inferred]` if that share is **≥ 80 %**, the offer is *tail-placed* — it
  surfaces, but almost never above the fold.

`rank_histogram` is `slot_basis: 'visual'`. The threshold 4 is a visual
position. **Do not** compare it to `adFeedCount`, `forced.adSlot`, or any
`server` slot; those are a different coordinate system, and the tool returns
them side by side precisely so that you report them adjacently rather than
subtract them. "Forced to server slot 2, realized at visual rank 5" is a
finding stated as two observations, not a delta of 3.

---

## R4 — Segment share read (B5)

`[derived]`, not inferred: when `segments_carry_forced_order` is true, the
share of zone traffic under a fixed order is Σ`trafficAllocation` over the
segments that carry a forced order. State it once, in the placement section,
and repeat it inside any R2/R3 sentence it affects. On such a zone a rank
histogram mixes auction outcomes with fixed-order outcomes and the payload
does not separate them; say so.

---

## R5 — Cross-zone stats

If `placement.scoringStatsOverride.status === 'on'`, the zone is scored on
`scoringStatsOverride.zoneId`'s stats `[observed]`. R1 and R2b then describe
that other zone's history applied here. Prefix every R1/R2b sentence on such a
zone with the override, and never write "scoring is per-zone" about it.

---

## The framing — what this analysis can and cannot tell you

Every report carries this block, adapted to the zone, before any inferred
sentence. It is not boilerplate; fill each line with the zone's actual state.

**Can tell you** `[observed]`/`[derived]`:
- which offers config makes eligible here, and via which path (`via`);
- which of those served in the window, with impressions per visual rank;
- which are pinned to a server slot, by ad, by group, or by segment, and for
  what share of traffic;
- whether the zone is scored on its own stats or another zone's;
- today's considered candidate set with score, trailing impressions and
  placement source;
- whether zone / ad group / ad config was touched inside the window, and by
  whom.

**Cannot tell you** — and will not guess:
- the share of opportunities an offer won: there is no offer-grain
  opportunity denominator, and `impressionsTotal` is the candidate-set
  numerator sum, not one;
- whether an `unknown` offer lost the auction or was never evaluated;
- which candidates were rejected before scoring, or why;
- why one score is higher than another — the component breakdown is not
  returned;
- what a config change inside the window actually changed;
- whether an offer restricted by dayparting, `geo[]`/`devices[]` or
  `exceptParams['zoneId-position']` was eligible for the requests that
  actually arrived — the join evaluates eligibility for *some* request, not
  *those* requests.

---

## Must not — four ways to produce a confident wrong answer

1. **`impressionsTotal` is not an opportunity denominator.** Never divide an
   offer's impressions by it and call the result a share of opportunity. The
   tool ships `candidate_impressions_sum` next to it so you can see they are
   the same number.
2. **A missing rank row is not "eligible and lost".** `unknown` is the enum
   value for that ambiguity. Report `unknown` as `unknown`.
3. **Visual rank and server slot are different coordinates.** Never subtract
   `rank_histogram` keys from `forced.adSlot`, `forcedAdPositions`,
   `forcedAdGroups[].position` or `adFeedCount`. Report them adjacently.
4. **No causal claim without a field.** "Surfaces at rank 6" is observed.
   "Because it performs badly" is not in any payload. If the sentence has
   "because" in it and no `[inferred]` label with a rule number, delete it.
