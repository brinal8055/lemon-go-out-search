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
