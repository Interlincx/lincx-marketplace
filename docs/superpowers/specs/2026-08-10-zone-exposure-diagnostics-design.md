# Zone Exposure Diagnostics — scoping read

Date: 2026-08-10
Status: scoping, not a build spec
Verified against: Adnet (`xvret6`), production MCP, 2026-08-10

Answers the three questions in *Zone Exposure Diagnostics — Question Set and
Scoping Request*: what collapses, what to sequence, what needs BE.

---

## 0. TL;DR

- **The thirteen questions collapse into two primitives**, not thirteen builds:
  a **join** (config eligibility ⟕ delivery rows ⟕ placement config) and a
  **probe** (the live scoring snapshot). Section A, B1–B3, B5 and C1 are reads
  of those two. B4 and C2/C3 are compositions on top.
- **The "not instrumented" list is wrong on three of six items.** `adScore` is
  readable today. The candidate set is half-readable today. The explore/exploit
  input (`impressions` in the scoring window) is readable today. Evidence in §2.
- **B5 is not a BE problem.** Every configuration mechanism that can place an
  offer in a slot its performance did not earn — except `cpmOverride` — is
  already readable on `get_zone` / `get_ad`. The doc under-reads this by a lot,
  and it is the single biggest change to the sequencing. Details in §2.3.
- **Two targeting axes are missing from the shipped eligibility tools**
  (dayparting, geo/device) and one is missing from the join (`zoneId-position`).
  That is an honesty gap in tools that already exist — `eligible` today means
  "eligible for *some* request", not "eligible now". §2.4.
- **The real BE ask is one item, not six**: the offer-grain opportunity
  denominator. It is the ceiling on B1/B2 and everything downstream. Rank it
  first, not last. §5.

---

## 1. The collapse (question 1)

The doc's own framing is right: one sentence, sliced. The slices need exactly
two new primitives.

### P1 — the exposure join

Eligibility set (config, `tools/eligibility.ts`) **⟕** delivery rows
(`report_query`) **⟕** placement config (`get_zone`) on
`(zoneId, adGroupId, adId, creativeId)`.

Both sides already exist and already share keys. Nothing joins them, which is
exactly why "eligible but never surfaced" is currently inexpressible. One
composite closes it.

Covers: **A1** (rank mix per ad, already one call — the join just adds the
denominator context), **B1** (eligible-but-crowded-out = the anti-join),
**B2** (one offer's row in that table), **B3** (same join at creative grain,
against `testCreatives` / `minTrafficAllocation` as the configured expectation),
**C1** (the same join run zone-wide for one offer).

### P2 — the scoring probe

A thin, normalized read of `/api/ads/ad/debug`, which returns the **considered
candidate set with its scores** (§2.1). Synthetic — "what would happen for a
request shaped like this, right now" — not history.

Covers: the observed half of **A2**, the candidate side of **B1**, the
"was it earned" side of **B5**.

### What does NOT collapse

- **B4** (exposure dropped this week — limits, targeting or competition?)
  is genuinely separate, for a reason the doc doesn't name: **config has no
  history.** Delivery is a time series; targeting and limits are a point-in-time
  read. You cannot diff a config nobody stored. There is a coarse partial
  signal — `dateUpdated` + `userUpdated` exist on zone, ad group and ad — so
  *"was this touched inside the window, and by whom"* is free. *What changed* is
  not. See §5.4.
- **C2/C3** are the join run per zone and diffed. Cheap once P1 exists, but they
  carry the highest risk on the observed-vs-inferred rule, because on this
  network a zone can be scored on **another zone's** stats (§2.3), so
  "cross-zone divergence is expected because scoring is per-zone" is not always
  true.

---

## 2. Corrections to §3 of the request

This is the section asked for explicitly. Each item was **independently re-run**
against the live API on 2026-08-10, not reasoned about and not read off the
2026-08-06 pass in the request. Where the two disagree, treat it as our check
finding more surface, not as the earlier check being sloppy.

### 2.1 `adScore` IS instrumented and readable — item 1 is wrong

`get_zone_ads({ zoneId, debug: true })` → `/api/ads/ad/debug` returns, per
candidate ad:

```json
{"id":"pie2dt","name":"Auto Insurance | RateSavings_Wisdom | fbz",
 "score":1.6491238790690257,"impressions":1144,"cpm":87.33566433566432,
 "adgroup":"Auto Insurance:ff26gi","campaign":"Auto Insurance:d65qkt",
 "advertiser":"Auto Insurance:51hs6p"}
```

plus `impressionsTotal` and `maxCPM` for the zone. Real numbers from zone
`hh4x9w` today: 22 candidates, scores 0.52 → 1.65, `impressionsTotal: 14583`.

So the score, its trailing impression count, and its CPM are all visible **per
(zone, ad)**. "There is no way to see why one offer outscored another" is not
correct — you can see *that* it outscored, by how much, and on what impression
base. What is missing is the **component breakdown** (which term produced 1.649),
which is a much smaller ask than instrumenting a score that does not exist.

Three caveats that matter and should be stated in any output built on it:
- It is a **synthetic probe of now**, not history. There is no time series. The
  BE-free path to one is polling and storing snapshots — which is a plugin
  concern, not an MCP concern.
- `score` comes back `null` on zones with no scoring stats (observed on `upd39v`
  and `6wahzt`, both returning `impressions: 0`). Absence of a score is not a
  score of zero.
- **`impressionsTotal` is not an opportunity denominator.** The 22 per-ad
  `impressions` values sum to exactly 14583 — it is the candidate-set sum, i.e.
  a numerator total. It does not weaken §5.1; the denominator is still missing.

And one limit on how far the probe can be pushed: **score is visible, but its
relationship to the `cpm` on the same row is not explained by the payload.**
`sg1rot` scores 1.449 at `cpm: 0`; `pie2dt` scores 1.649 at `cpm: 87.34`. Several
of the top scorers carry zero CPM, so score is not a monotone function of the
visible CPM — either that CPM is a different window than the score's, or
non-monetizing / action-based offers score on something else entirely. The probe
therefore shows **that** an offer outscored another; it does not, on this data,
explain **why**. That is precisely what §5.3's component breakdown buys.

### 2.2 The explore/exploit signal is half-observed — item 2 is partly wrong

The doc says the signal is "inferable from impression-count-against-RPM
patterns; never confirmable". The impression count **is the confidence input and
it sits on the same row as the score**. On `hh4x9w`: score 0.516 at 1809
impressions vs score 1.649 at 1144 — the score/impressions relationship is
directly observable across the whole candidate set in one call, rather than
reconstructed from reporting.

That does not give you a labelled `explore` flag, and it does not give you the
weighting function. It does turn A2 from *inference from a proxy* into
*inference from the actual inputs*, which is a materially better answer and
still must be labelled inferred.

### 2.3 B5 is answerable from config today — this is the big one

The doc treats "forced position, boost, tier assignment, position-level
exclusion" as largely unreadable. Four of five are readable. From `get_zone` on
`hh4x9w` (verbatim, trimmed):

```json
{"adFeedCount":25,
 "forcedAdPositions":{"k1176d":0,"bo3aa1":3,"sg1rot":2,"9ugbmm":9},
 "forcedAdGroups":[{"adGroupId":"ff26gi","position":1}],
 "segmentsStatus":"on",
 "segments":[{"name":"FB_tightmoney-1_fixed-order","trafficAllocation":50,
   "templateId":"w175rr","forcedAdPositions":{},
   "forcedAdGroups":[{"adGroupId":"9i80uw","position":0}, …27 entries…]}],
 "scoringStatsOverride":{"status":"off","zoneId":"so4ieh"}}
```

Four separate things fall out of that, none of which appear in the request doc:

1. **`forcedAdPositions`** — ad-id → slot, at zone level. Four ads on this zone
   are pinned. This is why the debug candidate list does not come back in score
   order.
2. **`forcedAdGroups`** — ad-group → slot, same idea one level up.
3. **`segments[]` with `trafficAllocation`** — the zone runs a 50% traffic split
   whose segment carries its **own template** and a **complete 27-entry forced
   order**. On this zone, roughly half of all realized rank rows are a fixed
   order, not an auction outcome. **Any rank analysis that ignores segments is
   wrong on this zone**, and wrong silently — precisely the failure mode the
   request's closing constraint is about.
4. **`scoringStatsOverride: { status, zoneId }`** — a zone can be scored on
   another zone's stats. When it is on, "scoring is per-zone, so cross-zone
   divergence is expected" (the C2 note) is false for that pair.

Plus `boost` on the ad (confirmed, default `1`).

So the only B5 mechanism genuinely dark is **`cpmOverride`** — and the request's
item 5 is correct, it is absent from `get_ad` (re-confirmed today). Tiering
placement is the other partial, and that one is a report-config ticket (§5.5).

### 2.4 Three targeting axes the shipped eligibility tools ignore

Not in the request doc, and worth flagging because it affects tools already in
clients' hands.

- **`exceptParams["zoneId-position"]` is live.** Found on ad group `y433xw`:
  `["hh4x9w-10","hh4x9w-9","hh4x9w-8","hh4x9w-7","hh4x9w-6"]`. Format is
  `<zoneId>-<position>`, i.e. **per-slot, not blanket**. So this is an
  *extension* to the eligibility join (eligible at which slots), not a
  correctness bug — with one exception: a group excluding every position
  `0..adFeedCount-1` is de facto ineligible and would today be reported
  eligible. That degenerate case deserves a guard regardless of when the rest
  ships.
- **Dayparting.** Ad `oddy43` carries `params["dateTimeUS/Pacific"]` — a
  168-slot day×hour whitelist. `eligibility.ts` reads only `zoneId`, so an ad
  restricted to weekday mornings reads as plainly "eligible".
- **`geo[]` and `devices[]`** on ad groups (empty on `y433xw`, but present as
  fields; the request doc's C-section explicitly assumes geo targeting exists).

Consequence for the design rule: **`eligible` in the shipped tools means
"eligible for *some* request", not "eligible now"**, and it does not say so.
That is the same class of defect as the inert-whitelist bucket we already fixed:
a field asserting a state it does not compute. Fixing the *assertion* (renaming
/ documenting / returning a `dimensions_evaluated[]`) is cheap and can ship
ahead of actually evaluating the axes.

### 2.5 Items the request got right

- **Item 3 (candidate set), half.** The **considered** set is returned by the
  debug probe. The **rejected** set and the stage each candidate dropped at is
  not in the payload. Half instrumented, half not.
- **Item 4 (dedup suppression)** — no event, agreed. B3's direct cause stays
  unrecorded; the configured-vs-realized creative split (`testCreatives`,
  `minTrafficAllocation`) is the best available answer and is an inference.
- **Item 5 (`cpmOverride`)** — absent, agreed.
- **Item 6 (opportunity denominator)** — agreed, and it is the ceiling. Without
  it, impressions-at-rank is a numerator with nothing underneath, and B1/B2 stay
  anecdotal no matter how good the join is. This is the BE item that matters.
- **The two closing consequences** — three-way ambiguity of a missing rank row,
  and `rank` being post-compression visual position rather than server slot —
  both hold, and both must be encoded in the output (§4).

---

## 3. Sequence (question 2)

One workflow at a time, each rung shippable and useful alone.

**Rung 1 — `get_zone_exposure` (MCP composite).** The join. Eligibility set ⟕
report rows ⟕ placement config, at offer grain, for one zone over a date range.
Emits per (adGroup, ad, creative): eligibility verdict (existing), realized rank
histogram, loads/impressions/clicks/revenue, and a **status enum** (§4). Same
size discipline as `get_zone_eligible_ad_groups` — whole-network scan
server-side, paged not degraded.
*Unlocks:* A1 with a denominator, B1, B2, C1. Zero BE.
*Why first:* it is the only rung the other rungs read from.

**Rung 2 — `get_zone_candidates` (MCP, thin).** Normalize the debug probe:
candidates with `score`, `impressions`, `cpm`, plus the zone's
`forcedAdPositions` / `forcedAdGroups` / `segments` / `scoringStatsOverride`
resolved into a per-candidate `placement_source` (`forced-ad` / `forced-group` /
`segment-forced` / `scored` / `boosted`).
*Unlocks:* B5 config side, in full, minus `cpmOverride`. A2's observed half.
*Small* — one endpoint plus a config resolve. Could ship with rung 1 if the
week allows; keep separate if not.

**Rung 3 — the skill (`lincx-marketplace`, not the MCP).** `zone-exposure`
skill + command, reading rungs 1 and 2. This is where the narrative lives: the
explore/exploit read, crowd-out thresholds, the "here is what I can and cannot
tell you" framing. Every inferred claim labelled at the sentence level.
*Why a skill, not a tool:* the numbers are the platform's, the prose is the
client's — same split as `lincx-analysis`. It also makes the observed/inferred
rule structural: **the tool emits only computed fields; the skill writes
inference and must label it.**

**Rung 4 — slot-aware eligibility.** Teach `eligibility.ts` `zoneId-position`,
plus the degenerate all-positions-excluded guard, plus a
`dimensions_evaluated[]` on every eligibility row so the assertion gap in §2.4
closes even before dayparting/geo are evaluated.
*Unlocks:* B5 exclusion side; removes a silent wrongness from shipped tools.

**Rung 5 — C2/C3.** Rung 1 run across zones and diffed, with
`scoringStatsOverride` and per-zone segment config surfaced as candidate causes.
Nearly free in code; the work is the discipline in the output.

**Rung 6 — B4.** Blocked on config history (§5.4). Deliver the coarse version
early inside rung 3 (`dateUpdated` inside the window → "config was touched on
<date> by <user>; contents of the change are not recorded") and revisit when BE
lands.

---

## 4. The design rule, made concrete

The request's closing constraint — separate observed from inferred — becomes two
mechanical rules, not a writing style:

1. **Every emitted field is one of `observed` / `derived` / `inferred`.**
   Observed = returned by the API. Derived = computed from observed by a rule we
   can state. Inferred = a heuristic. The tool emits only the first two; the
   third lives in the skill and is labelled in prose.
2. **Ambiguity returns `unknown`, never a guess.** The missing-rank-row status
   is an enum, not a boolean:
   `serving` | `eligible-never-surfaced` | `ineligible` | `not-evaluated` |
   `unknown`. When "eligible and lost" cannot be distinguished from "never
   evaluated" — which is the normal case until the opportunity denominator
   exists — the value is `unknown`. It is not allowed to collapse into
   `eligible-never-surfaced` because that reads as a finding.
3. **Position indices carry their coordinate system.** `rank` in reporting is
   the post-compression *visual* position; `forcedAdPositions` /
   `forcedAdGroups` / `zoneId-position` are *server slots* (`k1176d: 0` against
   `adFeedCount: 25`). Rung 1 is the tool that first puts those two side by
   side, and they are both integers with position-shaped names — the single most
   likely source of a confident wrong answer in this whole build. Every
   position-valued field carries `slot_basis: 'visual' | 'server'`, and the tool
   never computes a difference across the two bases. Realized rank and forced
   slot are reported adjacently, never subtracted.

Same discipline as assertion I4, applied to answers. It is also the reason the
join belongs in the MCP and the narrative does not: a tool cannot accidentally
write "because it performs badly" if it has no field for it.

---

## 5. The BE ask (question 3), ranked by value ÷ cost

Ranked so the expensive-and-slow item gets scoped now rather than three rungs in.

### 5.1 Offer-grain opportunity denominator — **scope this first**
The ceiling on everything in section B. Zone Loads do not propagate below the
first two hierarchy levels, so "share of opportunities won" is not computable at
offer × rank. Real instrumentation, weeks, and every rung above it is
quantitatively soft until it exists. The request ranks it sixth; it should be
first.

### 5.2 Reject array in `/api/ads/ad/debug`
The probe already returns the considered set. Adding the **rejected candidates
with the stage each dropped at** turns item 3 from half-instrumented to
instrumented, for probes. Small change to an endpoint that already exists and
already has the data in hand at the moment it responds.

### 5.3 Score component breakdown, and `cpmOverride` on `get_ad`
Batch as one small "expose these fields" ask. `cpmOverride` is confirmed absent
and is the last dark B5 mechanism. The score breakdown (which terms produced
`1.649`) is what turns A2 from inferred to observed.

### 5.4 Config change history
Needed for B4 and nothing else, so it can wait — but it is the only path to a
real answer. Two options worth putting to Nikunj and Dmitry:
a change log on entity writes, or a versions endpoint like templates already
have. Note that `dateUpdated` / `userUpdated` already exist, so the cheap half
("was it touched") is free and only the diff is missing.

### 5.5 Tiering telemetry + `scoreKey` — **config, not code**
The request lists these under "gated behind per-network report configuration",
and that read is right and worth making louder: `tierGroupsCandidates`,
`tierGroupsSlotsUsed`, `tierGroupsSlotsDisplayed`, `tierGroup`, `tierReserved`
and `scoreKey` **already ship on ad-load and ad-impression events**. This is a
per-network report/dimension-set setup ticket — ops, not engineering — and it is
the cheapest unlock in the whole document. On tiered zones it turns B1 from
inferred crowd-out into observed candidate-vs-placed. It should not sit in the
same queue as 5.1.

### 5.6 Not asked for
Per-decision transparency (the §4 end state in the request). Correctly out of
scope for now; 5.1 and 5.2 are the two rungs of it that pay off immediately, and
building them in that order means the end state is an extension rather than a
rewrite.

---

## 6. Assumptions

- Fixture network is Adnet (`xvret6`); zone `hh4x9w` is the worked example for
  contested + segmented + forced-position config, `upd39v` for the null-score
  case. Both are real and current.
- The BE conversation is opened by whoever owns the Nikunj/Dmitry thread; this
  document is the input to it, not the ticket.
- Nothing here touches `src/` yet. No code was written.
