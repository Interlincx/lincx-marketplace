# Report builder — reuse, create, add

Applies after the review in step 3 of `SKILL.md`. Examples use illustrative names and ids.

## The table

| After reviewing every set | Do |
|---|---|
| One or more sets have `missing = ∅` | Use one. No write. Fewest extras wins. Say which you used. |
| No set has `missing = ∅`, the user did not ask to extend one | Recommend **create** with exactly the required dimensions, then wait for confirmation. |
| No set covers it, the user asks to add to a report | Review all sets first. If one already covers it, say so and suggest it instead. If none does, pick the closest set (fewest missing, then fewest extras) and run the pre-flight. |
| Create is blocked: 50 active reports on the network, or an identical report exists | Use the identical report. At the cap, offer an add to the closest set with the full pre-flight, or ask the user to archive one in Reports Center. |
| Create is refused because the request equals a system report (`Dimension set equal to the system dimension set "…"`) | System reports are not in the catalog, so there is nothing to use instead. Suggest adding or dropping one dimension so the report is distinct, and confirm the change with the user. |

Create is the default because it cannot change what anyone else sees. The tool also returns an existing active report with the same dimensions, so a create that would duplicate is not written.

## Examples

Required: `zone`, `date`, `hour`.

| Set | Dimensions | missing | extra |
|---|---|---|---|
| `Zones Daily` (ab12cd-ef34gh) | date, zone, rank, device | hour | rank, device |
| `Zones Hourly` (ab12cd-ij56kl) | date, hour, zone | none | none |
| `Geo Daily` (ab12cd-mn78op) | date, geoRegion | zone, hour | geoRegion |

`Zones Hourly` covers it: use it, no write.

Required: `zone`, `date`, `geoRegion`, `hour`. No set has all four.
- Default: create `Hourly Delivery: Zone, Geo Region` with `["zone", "date", "geoRegion", "hour"]`, after confirmation.
- The user says "just add hour to Geo Daily": review all sets, find none better, then run the pre-flight. `Geo Daily` is missing `zone` and `hour`, so say that adding only `hour` still leaves `zone` out. Add both or create.

## Things the server decides

- `date`, `networkId` and the id/name pair of each entity dimension (`zone` brings `zoneId`) are added and ordered for you. Do not list them.
- The returned `dimensions` may not be in the order you sent, and the `*Id` fields can come at the end. That is normal.
- A name the network has never used is refused unless `allowNewDimensions: true`. Show the user the spelling and the catalog's closest names before asking.
- If an add would make the report equal another active one, upstream refuses and names that report. Use that one.
- Nothing to add: the tool writes nothing and says so.
