# Lincx targeting keys — what `params` / `exceptParams` mean and what they accept

Read this before building a targeting edit with `update_ad_group` or `update_ad`. The API stores any key with any string values, so a misspelled key or a wrong value saves without an error and quietly stops (or never stops) the entity from serving. The tools refuse the mistakes below, but build the call right the first time.

## How a visit is judged

- `params` is a **whitelist**: for each key in it, the visit must carry that key **with one of the listed values**. A visit that doesn't carry the key at all is refused. A whitelist on a key no visit carries refuses **every** visit.
- `exceptParams` is a **blacklist**: a visit carrying a listed value is refused. A visit without the key passes. The blacklist always wins.
- Every key must pass: keys are AND-ed, values within one key are OR-ed.
- Values are compared as exact strings. `geoState` is **case-sensitive** (`TX`, never `tx`).
- **Ad group first, then ad.** The group's rules decide whether the group serves on a visit at all. The ad's rules then decide which of the group's ads serve. An ad rule can only narrow: an ad can never reach a visit (or a zone) its group refuses.

## The call shape

Each key is edited on its own, inside `params` or `exceptParams`:

```js
params:       { geoState: { add: ['TX', 'OK'] } }              // add values, keep the rest
params:       { geoState: { remove: ['OK'] } }                 // remove values
params:       { 'dateTimeUS/Eastern': { set: [/* full list */] } } // replace the whole list
exceptParams: { device: { set: null } }                        // remove the key (no rule)
```

- When the user names the whole list ("only TX and OK"), the final list is exactly those values: remove every other stored value, or `set` from a fresh read. An `add` keeps what is already there.
- Use `add` / `remove` for small changes. Use `set` only to replace a list on purpose (a new schedule), and build it from a fresh `get_ad_group` / `get_ad` read — never from memory or an elided read.
- `add` and `remove` can go together on one key. `set` goes alone.
- Removing the last value removes the key, which removes the rule.
- At most 500 values per key per call.
- One call can edit several keys in both maps. It is all or nothing.

## Keys

| Key | What the visit carries | Values | Where |
|---|---|---|---|
| `geoState` | the visitor's US state | two-letter UPPERCASE code: `TX`, `CA` | either |
| `geoCountry` | country | two-letter UPPERCASE code: `US` | either |
| `geoCity`, `geoPostal`, `geoRegion`, `geoRegionName`, `geoCountryName` | other geo fields | as `get_event_stats_keys` shows them | either |
| `device` | device type from the user agent | `desktop`, `mobile`, `tablet`, `smarttv`, `console`, `wearable`, `embedded` | either |
| `deviceOs` | OS family | `ios`, `android`, `other` | either |
| time of day (below) | day + hour of the visit | `sun0` … `sat23` | either |
| `zoneType` | the zone's type | `Confirmation` or `Landing` (exact case) | either |
| `templateId` | the zone's template | template id | either |
| `channelType` | the zone's channel type — a category shared by every channel of that type, not one channel | a type the network's channels use, spelled exactly (`Car Insurance`, not `car insurance`), as `get_channel` shows it; the tool checks it | either |
| `publisherId`, `segmentId`, `segmentName` | the zone's publisher / segment | id / name | either |
| `position` | the slot the ad would fill | `1`, `2`, … | **exceptParams only** |
| `zoneId-position` | slot in a given zone | `<zoneId>-<slot>`, or `*-<slot>` for every zone | **exceptParams only** |
| `templateId-position` | slot in a given template | `<templateId>-<slot>` or `*-<slot>` | **exceptParams only** |
| `zoneId` | the zone | zone id | ad group: use `addZoneIds` / `removeZoneIds` / `addExceptZoneIds` / `removeExceptZoneIds`, never `params`. Ad: `params.zoneId` / `exceptParams.zoneId` |
| anything else | a client key — a tag data attribute or a mapped page param | as `get_event_stats_keys` shows them | either |

**Client keys.** A key not in the table must appear in `get_event_stats_keys({ network_id })` (the keys visits carried in the last 31 days), or already be on the entity. Otherwise the tool refuses it. Check the spelling there, since keys are case-sensitive. A few keys are on real requests but never recorded by event stats, so the tool accepts them without the check. Don't call them typos:
- `lincx-*` keys
- custom columns `c1`, `c2`, …
- `vertical`, `renderMode`

Event fields such as `siteId`, `channelId`, `experienceId`, `site` or `zone` are **not** request keys. No ad request carries them unless the tag sends them, so a whitelist on one stops the entity serving everywhere. To target one site, channel or experience exactly, use its zones (`zoneId`). `channelType` is a category: it also takes in every other zone whose channel shares the type, so offer it only when the user wants the whole category, and say which other zones it adds.

Pass `allowNewKeys: true` only once a source of the key is confirmed (event stats may not have recorded it yet). Either the user confirms the tag or page sends it, or `get_zone({ network_id, zoneId })` shows it in a zone's `dataAttributesDefault`, which supplies it on every visit to that zone.

Knowing the key exists is not the same as knowing a whitelist can match. A zone default only proves traffic for a whitelist when:
- the zone is one the entity can still reach after the edit (the group's zone lists and creative asset group, and for an ad its own `params.zoneId`), and
- its default value is one of the listed values.

A default on a zone the entity can't reach, or with another value, supplies nothing to this whitelist. When no reachable zone matches and the user can't confirm the tag sends a listed value, say before asking for confirmation that no matching traffic is verified, and that the entity may stop serving. Name the reachable zones that do match in the proposal, and still get the explicit confirmation.

## Time of day

- In `params`, pick **one** time key: `dateTimeUS/Eastern`, `dateTimeUS/Central`, `dateTimeUS/Mountain`, `dateTimeUS/Pacific`, `dateTimeUTC`, or `dateTimeVisitor` (the visitor's own local time). Two time keys in `params` means a visit must pass both, so the tool refuses an edit that adds a second one. Blacklisted time keys in `exceptParams` add up, so several are fine there. To switch timezone, `set: null` the old key and `set` the new one in the same call.
- Values are a three-letter lowercase day plus an hour from 0 to 23: `mon9` is Monday 09:00–09:59 in that timezone. Days: `sun mon tue wed thu fri sat`.
- Expand what the user said into the full list, then repeat it back as days × hours. For example, "weekdays 9am–5pm Eastern" is `dateTimeUS/Eastern` with `mon9 … mon16, tue9 … tue16, wed9 … wed16, thu9 … thu16, fri9 … fri16` (40 values; 5pm is the end, so the last hour is 16).
- All 168 values in a whitelist is the same as no rule. Say so and offer `set: null` instead. All 168 in a blacklist would never serve, so the tool refuses it.
- "Pause on weekends" can be a whitelist of the weekday hours, or a blacklist of `sat0 … sat23, sun0 … sun23`. Prefer the form the entity already uses.

## Slot blocks (`exceptParams` only)

These push the entity away from a slot. They never decide whether it is eligible at all, and they are **soft**: when no other ad is left for a slot, the ad server places a blocked entity there anyway. So say "kept out of slot N when other ads can fill it", never "never in slot N". When an ad group has a list for one of these keys, its ads' lists for that same key are ignored. One value per slot: glob ranges such as `*-[2-9]` are not accepted.

- "Only slot 1 in zone `i32ibj`" means blocking every slot from 2 up to the most ads any visit to the zone can get.
  - Read the count with `get_zone`: the larger of the zone's `adFeedCount` and every segment's (a segment-picked visit uses the segment's count). With no count set the default is 1.
  - A visit can raise it: a tag sending `adFeedCount`, or an `adFeedCount` in the zone's default data attributes, wins over the zone's own count. When the tag may send one, the list can't cover it. Say so.
  - For example, `zoneId-position: ['i32ibj-2', … 'i32ibj-9']` when the largest count is 9. A slot past the last one listed stays open.
  - A zone on a tiering-enabled template serves every eligible ad, so it has no fixed count. There, a finite list can't promise "only slot 1".
  - Since blocks are soft (above), even a full list is a preference, not a guarantee. Agree with the user on the upper slot and the wording rather than promising "only slot 1".
- `zoneId-position: ['*-2', '*-3', '*-4']`: slots 2–4 blocked in every zone.
- `position: ['1']`: never the first slot, in any zone.

## Traps the tools refuse (and how to say them)

- **Wrong value format** (`tx`, `mon24`, `phone`, a slot block without `-<slot>`). Fix the value; don't drop it.
- **A position key in `params`.** Slot blocks only work in `exceptParams`.
- **A second time key in `params`.** Replace the old key in the same call.
- **An ad slot block on a key its ad group already blocks.** The group's list for that key replaces the ad's own list, so the ad's block would never apply. Changing the group's list instead (`ad-group-editor`) changes placement for every ad in the group, not just this one: say so and get that broader change confirmed on its own.
- **A blacklist naming every value of its key** (every device, every OS, the full week). It would never serve.
- **The same value in `params` and `exceptParams`.** The blacklist wins, so the whitelist entry is dead. Remove it from one.
- **`params.geoState` / `params.device` on an ad group that uses its legacy `geo` / `devices` field.** The API refuses both at once, and the legacy field is cleared in the Lincx UI.
- **An unseen client key** (`… not a Lincx targeting key …`). Check `get_event_stats_keys`. Pass `allowNewKeys` only once a source of the key is confirmed (the tag or page, or a zone default; see Client keys).

## Before and after

- **Before:** the stored rules from `get_ad_group` / `get_ad`. Show current → proposed per key: values added and removed, or the new list as days × hours for a schedule.
- **Say what it changes in plain words:** "only visits from TX or OK", "never on mobile", "only Monday–Friday 9–17 Eastern", "kept out of slots 2–4 when other ads can fill them".
- **After:** `explain_serve({ network_id, zoneId, adGroupId })` (or with `adId`) for a zone the user cares about.
  - A rule on `geoState`, `device`, `deviceOs` or a time key is always taken from the visit, so it makes the answer **conditional**. Read its `conditions` (`requires` / `excludes` with values) back to the user. That is the new rule working, not a failure.
  - A condition lists at most 20 values. When `valuesTotal` is greater than the values shown, the list is cut. A rule this edit set is restated from the confirmed proposal, labelled as the edited rule. Any other cut list (for example a group rule an ad inherits) is described as partial, with its total, or read in full with `get_ad_group` / `get_ad` first. A cut list is never the whole rule.
  - In `get_ad_group_zone_reach`, such a rule moves zones from `summary.reaches` to `summary.conditional`. That is the rule applying, not lost reach.
  - A key the zone sets itself (`zoneType`, `templateId`, `channelType`), or a client key in the zone's default data attributes, is judged against the zone's value. A zone that doesn't match drops out (`excludedByDefault`, or out of the reach list altogether). Report those zones as lost on the zone's default traffic, by comparing before and after.
  - Any other client key reads **conditional**. Read the condition's `op`:
    - `requires` (a whitelist) means "serves only on visits that carry a listed value". If nothing sends that key with that value, the entity never serves. Before calling it success, confirm a source: the tag or page sends it, or a zone's default supplies it.
    - `excludes` (a blacklist) means visits carrying a listed value are blocked, and visits without the key pass. Report it as "blocked when the visit sends X". No source is needed for it to work, and a missing key is not a delivery failure.
