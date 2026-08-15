# Source adapters

`osm.ts` contains the human-approved SRC-01 OpenStreetMap/Overpass adapter. It
issues one bounded multi-tag query inside the configured Jönköping municipality,
then relies on the active REF-01 boundary for canonical scope validation.

OSM source identity is serialized as `<element-type>/<element-id>` (for example,
`node/123`, `way/123`, or `relation/123`). Names, coordinates, and tags never
participate in SourceRecord identity. Only the extracted envelope permitted by
the `OSM_OVERPASS` source policy is captured; transport payloads and contributor
account fields are discarded.

Normal tests use the sanitized fixture under `fixtures/osm/` and never call
Overpass. The live bounded command is:

```sh
pnpm ingest:osm --scope a4b19b09-b272-5748-80ef-2c91d9d33ca6 --bounded
```

`jonkoping-utegym.ts` is the SRC-02 municipal supplement. It is deliberately
limited to the official Jönköpings kommun Utegym layer 41. Source identity is
`layer-41/globalid/<lowercase GlobalID>`. The adapter requests EPSG:4326 from
ArcGIS, retains only the reviewed factual envelope, and treats polling as
`DELTA_ONLY` because the continuously updated layer has no published atomic
snapshot contract.

```sh
pnpm ingest:municipal --layer utegym --scope a4b19b09-b272-5748-80ef-2c91d9d33ca6 --bounded
```

`jonkoping-events.ts` is the promoted SRC-03B bounded adapter. It reads the bounded
public municipality calendar route and official Event pages, retains factual
extracted fields, and accepts `event/<source-event-uuid>` only when exactly one
source schedule exists. Multi-occurrence records are skipped because the source
does not expose durable occurrence IDs. Accepted future occurrences flow through
the shared immutable evidence pipeline and the approved manual SCHEDULED
interpretation; absence remains meaningless under `DELTA_ONLY`.

```sh
pnpm source:smoke:event
pnpm ingest:event
```
