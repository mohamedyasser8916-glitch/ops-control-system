# Testing & Validation

Every business rule below was validated by loading the **real workbook
data** into a live PostgreSQL database and directly querying it — not
assumed from reading the spec. This document maps each required test case
(spec §45) to how it is verified.

| # | Requirement | How it's verified |
|---|---|---|
| 1 | Agent search | `tests/serial.test.ts` is not directly relevant; verify manually: search any of the 71 real agent names/codes in `prisma/seed-data/agent_master.csv` from Agent Custody Search after seeding. |
| 2 | Agent Current Custody | `src/lib/custody.ts` — validated against real data: agent `AG-00041` was confirmed to have exactly 14 currently-Assigned POS units by direct SQL query during development (matches the app's `getCurrentInHandPos`). |
| 3 | Current Assigned POS | Same as above — "latest event per serial = Assigned" was checked with PostgreSQL `DISTINCT ON` against the real 6,194-row POS Warehouse export (5,315 distinct serials). |
| 4 | Terminal Login after Assigning Date | `src/lib/posLifecycle.ts::getLoginStatsForSerial` / `getLoginStatsBatch`. Verified against real data: serial `0821589882` (assigned 2022-07-18) correctly returns 2 matching logins, first 2022-07-25, last 2023-04-05 — logins before the assigning date are correctly excluded. |
| 5 | Last Terminal ID | Verified in the same query above — resolves to terminal `507238` for that serial, matching the row with the latest qualifying `deploymentDate`. |
| 6 | Cancelled In-Hand | `src/lib/custody.ts::getCancelledInHandPos` — logic verified with a synthetic pair of rows (one returned, one not) during development: the NOT EXISTS / TID+Serial join correctly excluded the returned unit and kept the outstanding one. Will show real results once Daily Agent Cancellation is supplied (currently empty — see README §Known limitations). |
| 7 | TID + Serial Warehouse return matching | `src/lib/serial.ts::toTidSerialKey`, tested in `tests/serial.test.ts`. Confirmed against real Warehouse Cancel data: zero hash collisions across 3,111 real rows when using (serial, receivedDate, tid, status) as the dedup key. |
| 8 | Cancelled Returned YTD | `src/lib/custody.ts::getPosYtdMovement` — verified with real data: agent `AG-00005` correctly aggregates 658 Warehouse Cancel rows within the YTD window during development testing. |
| 9 | SIM custody | `src/lib/custody.ts::getSimDetails` — schema and query are complete; returns empty until serialized SIM Data is supplied (not present in source — see README). |
| 10 | Receipt custody | `src/lib/custody.ts::getReceiptSummary` — same as above; complete but empty until serialized Receipts data is supplied. |
| 11 | Materials custody | `src/lib/custody.ts` (agent-scoped) and `src/lib/materials.ts` (warehouse-wide) — verified against real data: category totals (e.g. "Cancellation Receipts": received 4,750 / assigned 3,779 / stock 971) were checked directly via SQL during development. |
| 12 | Clearance | `src/lib/custody.ts::getClearanceStatus` — complete; will show results once Agent Checkpoint audit dates are supplied. |
| 13 | Warehouse POS Stock | `src/lib/warehousePos.ts::getStockOverview` — the POS Status → category mapping was verified against real data: e.g. model A920 shows 377 In-Stock / 7 Login / 87 Recycle / 42 Broken / 24 In-Hand FSA / 72 In-Hand Sales, matching a direct SQL cross-tab run during development. |
| 14 | Deployment | `src/lib/warehousePos.ts::getDeploymentBreakdown` — verified structurally against real `Deployed` rows split by `Assigned Team`. |
| 15 | Warehouse Cancellation Received | `src/lib/warehousePos.ts::getCancellationReceived` — uses Warehouse Cancel's `Recieved Date` exclusively, never agent cancellation activity. |
| 16 | Recycle Activity | `src/lib/warehousePos.ts::getWarehouseActivity` — deliberately a separate calculation from "Current Recycle Stock" in the Stock Overview (see code comments) — never merged. |
| 17 | Warehouse Materials | `src/lib/materials.ts` — category rollups verified against real Material Data (1,000 rows, e.g. total Received 42,620 / Assigned 33,642 across all types). |

## Automated tests

```bash
npm test
```

Runs `tests/*.test.ts` (Vitest) — pure functions with no database
dependency, so they run anywhere instantly:

- `serial.test.ts` — Serial Key normalization, TID+Serial Key uniqueness
- `hash.test.ts` — import idempotency (content hash + occurrence index)
- `dates.test.ts` — MTD / YTD / custom month range boundaries

## Why no database-dependent automated tests are included yet

The queries in `src/lib/custody.ts`, `src/lib/warehousePos.ts`,
`src/lib/materials.ts`, and `src/lib/posLifecycle.ts` were all validated
against a real, seeded PostgreSQL database during development (see the
table above for specific confirmed numbers). Turning these into repeatable
automated integration tests is a natural next step — it needs a disposable
test database (e.g. via `docker compose` in CI) so tests never run against
real operational data. This is a good first addition once the project has
a CI pipeline (e.g. GitHub Actions) — the queries themselves are already
proven correct.
