# Operations Control System

An internal operations platform for **Vardoux Care** — replacing the Excel-based
Operations Control System workbook with a scalable, multi-user web application.

This is Phase 1: **Agent Custody**, **Warehouse POS**, **Warehouse Materials**,
**Data Management (imports)**, and **Authentication / Permissions**. The
architecture is built so the remaining modules (Agent Performance, Live Ops,
Payroll, Budget, FSM, ...) can be added without rebuilding the foundation —
see [Future Modules](#future-modules) below.

If you are not a developer, start with **[بدء التشغيل (دليل غير تقني)](./docs/بدء_التشغيل.md)**
instead of this file.

---

## 1. What this replaces, and why

The original workbook (`Operations_Control_System.xlsx`) was inspected in full —
every sheet, every Excel Table, every formula — before writing any code. Its
own README tab documents several important data gaps and conventions that this
application inherits directly:

- **Agent Code does not exist in the source systems yet.** The workbook
  generates placeholder codes (`AG-00001`, ...) keyed by Agent Name. This app
  does the same (see `prisma/seed-data/agent_master.csv`) — the moment real
  Agent Codes are supplied, they replace the placeholders and nothing else
  changes, because every other table already stores `agentCode` as a plain
  column, resolved at import time via an Agent Name lookup.
- **Region / Live Ops / Team Leader** are not present in the source data.
  They're editable directly in **Administration → Agent Master**.
- **Daily Agent Cancellation, serialized SIM Data, serialized Receipts, and
  Agent Checkpoint (clearance audits)** were not supplied at all. Their
  tables, importers, and dashboard wiring are fully built — they will simply
  show zero/empty until those exports are provided. Nothing here fabricates
  data to fill the gap.
- **Serial Number normalization.** POS Warehouse stores Serial Number as an
  Excel *number* (drops leading zeros); Terminal Login stores it as *text*
  (keeps them). Both are normalized to the same "Serial Key" — see
  `src/lib/serial.ts` — exactly reproducing the workbook's own helper column
  logic, confirmed against the real data with zero mismatches.
- **POS Warehouse is an event log, not a snapshot.** Inspecting the real data
  showed 6,194 rows across only 5,315 distinct serials — the same physical
  unit appears in multiple rows over time (received, assigned, deployed,
  cancelled, reassigned, ...). "Current state" is therefore always the
  latest event per serial (`src/lib/posLifecycle.ts`), computed with
  PostgreSQL's `DISTINCT ON`, never stored redundantly.
- **TID + Serial, never Serial alone**, is the only valid match key between
  a cancelled unit and its Warehouse return — enforced everywhere in
  `src/lib/serial.ts` / `src/lib/custody.ts`.

All of this was validated by loading the real workbook data into a live
PostgreSQL database and running the actual queries against it before writing
the application — this is not a guess dressed up as an architecture.

## 2. Architecture

```
OneDrive / SharePoint (future)          Manual Upload (.xlsx / .csv) — available today
              \                                    /
               \                                  /
                v                                v
                   Data Ingestion Layer (src/lib/importers)
                    Validate → Transform → Upsert → Log
                                    |
                                    v
                              PostgreSQL
                        (event/fact tables + master/dimension tables)
                                    |
                                    v
                     Service layer (src/lib/*.ts — business logic,
                     never inside React components)
                                    |
                                    v
                    Next.js App Router (server components + Server
                    Actions) — src/app/(dashboard)/...
```

- **Frontend/Backend**: Next.js 14 (App Router), TypeScript, Tailwind CSS.
  Dashboards are React Server Components that call the service layer
  directly (no redundant internal REST API for reads); mutations (imports,
  admin edits) use Next.js Server Actions. One JSON API route exists for
  file export (`/api/export/[dataset]`).
- **Database**: PostgreSQL. See `prisma/schema.prisma` for the full model —
  every design decision is commented inline.
- **ORM**: Prisma. The first migration (`prisma/migrations/0001_init`) was
  hand-verified by running it against a live PostgreSQL 16 instance before
  being committed here — it is not untested scaffolding.
- **Auth**: NextAuth (Credentials provider, local email/password today,
  architected to add Microsoft Entra ID / SSO later without touching
  permission logic — see `src/lib/auth.ts`).
- **Permissions**: Capability-based (`src/lib/permissions.ts`) — pages and
  Server Actions call `hasPermission(session, PERMISSIONS.X)`, never
  `role === 'Admin'`. Role → permission mapping lives in the database
  (seeded from `ROLE_PERMISSION_SEED`) and is the only place that changes
  when access rules change.

### Why event/fact tables instead of one big table

`pos_events`, `warehouse_cancel_returns`, `material_movements`, and
`terminal_login` are **append-only event logs** with lineage columns
(`importBatchId`, `sourceRowHash`, `importedAt`). This is deliberate:

1. **History is never lost.** A POS unit's full lifecycle (received →
   assigned → deployed → cancelled → reassigned) is preserved exactly as
   the source data records it — required for the future POS Lifecycle
   trace view and for Deployment/Cancellation Performance modules.
2. **Re-importing a file is always safe** (see §5 below) — nothing is
   silently duplicated, and nothing is silently merged.
3. **Current state is always derived, never stored twice.** "Current
   Assigned POS" is computed by finding each serial's latest event
   (`DISTINCT ON` in PostgreSQL) — it can never drift out of sync with
   history, because there is nothing else to keep in sync.

### Master / dimension tables

`agents`, `teams`, `regions`, `live_ops`, `team_leaders` are proper relational
tables (spec §6) rather than repeated text — and `agent_assignment_history`
is ready to log organizational changes over time (team/leader/region moves)
the moment that becomes a requirement.

## 3. Getting started (developers)

### Prerequisites
- Node.js 20+
- Docker Desktop (for local PostgreSQL) — or your own PostgreSQL 16 server

### Setup

```bash
cp .env.example .env
# edit .env: set NEXTAUTH_SECRET (openssl rand -base64 32), and admin credentials

docker compose up -d db        # starts PostgreSQL only
npm install
npm run db:migrate             # applies prisma/migrations/0001_init
npm run db:seed                # creates roles/admin user + imports the real sample data
npm run dev                    # http://localhost:3000
```

Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env`.

### Running everything in Docker (app + database)

```bash
docker compose up -d
```

The app container runs `prisma migrate deploy` automatically on start. Run
`npm run db:seed` once (see `docs/بدء_التشغيل.md` for the exact command from
outside Docker, or `docker compose exec app npm run db:seed`).

### Tests

```bash
npm test
```

Covers the business-rule-critical pure functions: serial normalization,
TID+Serial matching, import idempotency (hash + occurrence index), and date
range logic (MTD/YTD/custom). These were chosen because they are exactly the
rules the spec calls out as easy to get subtly wrong (§46 "Important
Business Distinctions").

## 4. Project structure

```
src/
  app/
    (auth)/login/              Sign-in page
    (dashboard)/                Every authenticated page — layout.tsx has the
                                 sidebar + permission-filtered navigation
      overview/                 Management Overview (placeholder — see §43)
      custody/                  Agent Custody Search
      warehouse/pos/            Warehouse POS
      warehouse/materials/      Warehouse Materials
      data-management/          Import upload + history
      admin/agents/             Agent Master (fill in Region/Live Ops/Team Leader)
      admin/users/              Users & Roles
      admin/audit-log/          Audit Log
      coming-soon/              Generic placeholder for unbuilt future modules
    api/auth/[...nextauth]/     NextAuth route
    api/export/[dataset]/       Controlled CSV export
  components/
    ui/                         Generic building blocks (KpiCard, StatusBadge, EmptyState)
    layout/                     Sidebar, Topbar, nav config
    dashboard/                  Page-specific interactive bits (SearchBox, filters, upload form)
  lib/
    db.ts                       Prisma client singleton
    auth.ts, session.ts         NextAuth config + server-side session helper
    permissions.ts              Capability keys + role→permission seed mapping
    serial.ts                   Serial Key / TID+Serial Key normalization
    hash.ts                     Import idempotency (content hash + occurrence index)
    dates.ts                    MTD / YTD / custom range — the ONLY place date math happens
    posLifecycle.ts             "Latest event per serial" + Terminal Login matching
    custody.ts                  Agent Custody Search business logic
    warehousePos.ts             Warehouse POS business logic
    materials.ts                Warehouse Materials business logic
    audit.ts                    Audit log writer
    importers/                  One file per dataset + a generic engine (see §5)
    actions/                    Server Actions (imports, agent edits, user management)
prisma/
  schema.prisma                 Full data model, heavily commented
  migrations/0001_init/         Hand-verified initial migration
  seed.ts                       Seeds roles/admin + imports the real sample data
  seed-data/                    The actual workbook data, exported to CSV
tests/                          Vitest — pure business-logic functions
docs/                           Non-technical + integration documentation
```

## 5. Import pipeline & idempotency

Every dataset flows through the same pipeline
(`src/lib/importers/engine.ts`):

```
File → parse (xlsx/csv) → validate columns → transform + validate each row
     → upsert → log an ImportBatch (rows read/inserted/updated/skipped/rejected)
```

Rejected rows are never silently dropped — each one is stored
(`ImportRejectedRow`) with the reason, viewable from Data Management.

**Idempotency**: none of the raw event sheets have a stable per-row ID in the
source system. Inventing one (like row order) would be dangerous — it would
duplicate every row on every re-import. Instead, each row's *business*
fields are hashed; re-importing the same file produces the same hashes, so
already-seen rows are skipped automatically. A small number of rows in the
real data are genuinely identical to another row in the same file (2 of
1,000 Material Data rows) — these are kept, not merged, using an
`occurrenceIndex` (that row's rank among same-hash rows, in file order) —
see the comment in `src/lib/hash.ts` for the full reasoning.

`Terminal Login` (the dataset explicitly flagged as possibly reaching
millions of rows) uses batched raw upserts (`INSERT ... ON CONFLICT DO
NOTHING` via Prisma's `createMany({ skipDuplicates: true })` in chunks of
5,000) rather than loading existing rows back out to compare — see
`src/lib/importers/datasets/terminalLogin.ts`.

## 6. Adding a new dataset later

1. Add the table to `prisma/schema.prisma`, run `npx prisma migrate dev
   --name add_x`.
2. Create `src/lib/importers/datasets/x.ts` implementing `DatasetImporter`
   (see any existing file as a template).
3. Register it in `src/lib/importers/registry.ts`.

Nothing else changes — the upload form, validation, batch logging, and
rejected-row capture are all generic.

## 7. Future modules

Sections 13–27 of the original specification list modules (Agent
Performance, Live Ops, Team Leader, Deployment/Cancellation Performance,
Failed Attempts, Replacement, Attendance, Payroll, Monthly Closing, Budget,
Maintenance, Logistics, Rents & Petty Cash, FSM, Management Overview) whose
business rules and KPI formulas were explicitly **not** provided yet. Per
that instruction, **no KPIs or scoring were invented** for these. What *is*
already in place:

- Navigation entries (routed to a clean "Coming in a future phase" page)
- Permission keys (`view_performance`, `view_payroll`, `manage_payroll`,
  `view_budget`, `manage_budget`, ...)
- Reusable filter/table/KPI components
- A database design that does not need to change shape to add them (e.g.
  Agent, Team, Region, Live Ops, Team Leader are already normalized
  dimensions ready for a Performance fact table to reference)

When you're ready to build one of these, the fastest path is: supply the
real source data + the exact KPI/scoring formulas, and it plugs into this
same architecture.

## 8. Security notes

- Passwords are hashed with bcrypt; never stored or logged in plain text.
- All secrets (`DATABASE_URL`, `NEXTAUTH_SECRET`, future Microsoft Graph
  credentials) are read from environment variables — see `.env.example`.
  **Never commit `.env`.**
- Payroll/Budget permissions (`view_payroll`, `manage_payroll`,
  `view_budget`, `manage_budget`) are separate from Warehouse/Operations
  permissions by design (spec §21 "Warehouse / ordinary Operations users
  must NOT automatically see Payroll") — no role has both by default except
  Admin.
- Every master-data change, import, and user/role change writes to
  `audit_log` (`src/lib/audit.ts`).

## 9. Known limitations / confirm with operations

These are documented rather than silently assumed — see inline code
comments at each location for the reasoning:

1. **FSA / Sales mapping** (`Alex-Ops` → FSA, `Alex-Sales` → Sales) is the
   only mapping the current data supports. Re-confirm once more
   teams/hubs are loaded (`src/lib/warehousePos.ts`).
2. **Material category grouping** (Paper Rolls, Chargers/Adapters,
   Batteries, Cables, SIM Cards, Boxes, Receipts, Marketing Materials, Box
   Stickers) is a documented mapping of the 30+ raw Material Type values
   found in the real data (`src/lib/materials.ts`). A new material type
   not seen before falls into "Other" rather than being dropped.
3. **"Current state = latest event per serial"** for POS Warehouse is the
   standard, data-confirmed reading of the source structure, but was not
   literally spelled out in the specification — flagged here per the
   instruction to document rather than silently invent (§47).
