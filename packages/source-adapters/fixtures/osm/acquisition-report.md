# SRC-01 bounded OSM acquisition

- Endpoint: `https://overpass-api.de/api/interpreter`
- Bounds (south, west, north, east): `57.775,14.145,57.795,14.185`
- Query SHA-256: `0425455f5a5ad38c7206461779efa5443f56b1d98695de2366bd548cd7927c90`
- First fetch: `2026-08-14T05:34:26.517Z`
- First run: `cec2d40f-b8f5-4bd3-b7f5-4d0adb48b7a5`
- Rerun: `1763be69-820a-40b8-bf94-0ee701c9d7b7`
- Source policy: extracted fields only; DELTA_ONLY
- Attribution: © OpenStreetMap contributors

| Result | First run | Rerun |
|---|---:|---:|
| fetched | 20 | 20 |
| parsed valid | 20 | 20 |
| invalid | 0 | 0 |
| NEW | 20 | 0 |
| CHANGED | 0 | 0 |
| UNCHANGED | 0 | 20 |
| inside active Jönköping boundary | 20 | 20 |
| outside | 0 | 0 |
| unresolved | 0 | 0 |
| selected source evidence | 20 | 20 reused |
| canonical Place processing | 20 | 0 changes |

After both runs the database contained 20 OSM SourceRecords, 20 immutable
SourceRecordVersions, 20 successful ParseAttempts, and 20 linked canonical
Places. The rerun created no duplicate evidence or canonical rows.

Sample source keys and canonical Place IDs from the first run:

| Source key | Canonical Place ID |
|---|---|
| `node/2271410640` | `93af38ba-2b67-479c-b2ee-b24d7fb6376f` |
| `node/2271413648` | `6c77b917-7f85-473a-ad52-cf8dfbde3f2f` |
| `node/254912492` | `87f25bdf-706f-4d7b-b65d-079d7ea27354` |
| `node/254915323` | `ff207c2c-39c1-463d-8058-44ab175b20b6` |
| `node/254970739` | `7f829d13-ecca-4128-9e1b-2fd8d13292a3` |

The checked-in fixture is a representative sanitized subset. It excludes the
Overpass transport envelope and contributor account fields (`user`, `uid`, and
`changeset`).
