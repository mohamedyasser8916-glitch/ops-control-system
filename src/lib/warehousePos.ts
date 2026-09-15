import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { DateRange } from '@/lib/dates';

/**
 * Warehouse POS dashboard — business logic (spec section 10).
 *
 * POS Status -> Stock Category mapping was reverse-engineered from the
 * real workbook (POS Status x Stock Status cross-tab) and documented in
 * the workbook's own README tab (note 9). It is NOT guessed:
 *   Ready              -> In-Stock
 *   POS Login          -> Login
 *   Branding           -> Recycle
 *   Broken             -> Broken
 *   Assigned           -> In-Hand (split FSA/Sales by Assigned Team)
 *   Deployed / Transfer -> excluded (not on-hand stock at this hub)
 *
 * FSA/Sales mapping: Alex-Ops -> FSA, Alex-Sales -> Sales (the only two
 * team categories that exist in the data — spec section 10 / workbook
 * README note 8). This mapping should be re-confirmed with operations
 * once more hubs/teams are loaded.
 */
export const POS_MODELS = ['A920', 'A920 PRO', 'A960', 'P3', 'X990'] as const;
const FSA_TEAM = 'Alex-Ops';
const SALES_TEAM = 'Alex-Sales';

export type LocationFilter = { scope: 'EGY' } | { scope: 'CITY'; city2: string };

function cityCondition(location: LocationFilter): Prisma.Sql {
  return location.scope === 'EGY' ? Prisma.sql`TRUE` : Prisma.sql`"city2" = ${location.city2}`;
}

export async function getAvailableCities(): Promise<string[]> {
  const rows = await prisma.posEvent.findMany({
    where: { city2: { not: null } },
    distinct: ['city2'],
    select: { city2: true }
  });
  return rows.map((r) => r.city2 as string).sort();
}

export type StockOverviewRow = {
  model: string;
  inStock: number;
  login: number;
  recycle: number;
  broken: number;
  inHandFsa: number;
  inHandSales: number;
};

export async function getStockOverview(location: LocationFilter): Promise<StockOverviewRow[]> {
  const rows = await prisma.$queryRaw<Array<{ model_type: string; in_stock: bigint; login: bigint; recycle: bigint; broken: bigint; in_hand_fsa: bigint; in_hand_sales: bigint }>>(Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON ("serialKey") "modelType", "posStatus", "assignedTeam"
      FROM pos_events
      WHERE "serialKey" IS NOT NULL AND ${cityCondition(location)}
      ORDER BY "serialKey", "actionDate" DESC NULLS LAST, "importedAt" DESC
    )
    SELECT "modelType" AS model_type,
      count(*) FILTER (WHERE "posStatus" = 'Ready')::bigint AS in_stock,
      count(*) FILTER (WHERE "posStatus" = 'POS Login')::bigint AS login,
      count(*) FILTER (WHERE "posStatus" = 'Branding')::bigint AS recycle,
      count(*) FILTER (WHERE "posStatus" = 'Broken')::bigint AS broken,
      count(*) FILTER (WHERE "posStatus" = 'Assigned' AND "assignedTeam" = ${FSA_TEAM})::bigint AS in_hand_fsa,
      count(*) FILTER (WHERE "posStatus" = 'Assigned' AND "assignedTeam" = ${SALES_TEAM})::bigint AS in_hand_sales
    FROM latest
    GROUP BY "modelType"
  `);

  const byModel = new Map(rows.map((r) => [r.model_type, r]));
  return POS_MODELS.map((model) => {
    const r = byModel.get(model);
    return {
      model,
      inStock: Number(r?.in_stock ?? 0),
      login: Number(r?.login ?? 0),
      recycle: Number(r?.recycle ?? 0),
      broken: Number(r?.broken ?? 0),
      inHandFsa: Number(r?.in_hand_fsa ?? 0),
      inHandSales: Number(r?.in_hand_sales ?? 0)
    };
  });
}

export function summarizeStockKpis(rows: StockOverviewRow[]) {
  const ready = rows.reduce((s, r) => s + r.inStock + r.login, 0);
  const notReady = rows.reduce((s, r) => s + r.recycle + r.broken, 0);
  const inHand = rows.reduce((s, r) => s + r.inHandFsa + r.inHandSales, 0);
  return { ready, notReady, inHand, total: ready + notReady + inHand };
}

/** Deployment Breakdown — POS Status = 'Deployed', by model + FSA/Sales, in the given date window (deploymentDate). */
export async function getDeploymentBreakdown(location: LocationFilter, range: DateRange) {
  const rows = await prisma.posEvent.groupBy({
    by: ['modelType', 'assignedTeam'],
    where: {
      posStatus: 'Deployed',
      deploymentDate: { gte: range.start, lt: range.end },
      ...(location.scope === 'CITY' ? { city2: location.city2 } : {})
    },
    _count: { _all: true }
  });

  const byModel = new Map<string, { fsa: number; sales: number }>();
  for (const r of rows) {
    const key = r.modelType ?? 'Unknown';
    const entry = byModel.get(key) ?? { fsa: 0, sales: 0 };
    if (r.assignedTeam === FSA_TEAM) entry.fsa += r._count._all;
    if (r.assignedTeam === SALES_TEAM) entry.sales += r._count._all;
    byModel.set(key, entry);
  }

  return POS_MODELS.map((model) => {
    const e = byModel.get(model) ?? { fsa: 0, sales: 0 };
    const total = e.fsa + e.sales;
    return { model, deployedFsa: e.fsa, deployedSales: e.sales, totalDeployed: total, fsaPercent: total > 0 ? Math.round((e.fsa / total) * 100) : 0 };
  });
}

/**
 * Cancellation Received (spec section 10): machines PHYSICALLY RECEIVED by
 * the Warehouse. Source = Warehouse Cancel, date field = Received Date.
 * Never derived from Agent cancellation activity.
 */
export async function getCancellationReceived(location: LocationFilter, range: DateRange) {
  // NOTE: Warehouse Cancel has no "City2" hub column like POS Warehouse —
  // its "City" column plays that same role (confirmed against the real
  // data: constant "Alex", exactly like POS Warehouse's City2). So the
  // location filter here matches against `city`, not `city2`.
  const rows = await prisma.warehouseCancelReturn.groupBy({
    by: ['modelType'],
    where: {
      receivedDate: { gte: range.start, lt: range.end },
      ...(location.scope === 'CITY' ? { city: location.city2 } : {})
    },
    _count: { _all: true }
  });
  return rows.map((r) => ({ model: r.modelType ?? 'Unknown', count: r._count._all }));
}

/**
 * Warehouse POS Activity (spec section 10). Recycle Activity here means
 * cancelled units RECEIVED into the Warehouse and classified as Branding
 * — distinct from "Current Recycle Stock" in the Stock Overview above,
 * which is the current on-hand count. These two numbers will diverge and
 * that is expected; never merge their definitions.
 */
export async function getWarehouseActivity(location: LocationFilter, range: DateRange) {
  // pos_events uses the City2 hub column; warehouse_cancel_returns uses
  // City for the same purpose (see note in getCancellationReceived above).
  const posEventCityCond = location.scope === 'CITY' ? { city2: location.city2 } : {};
  const cancelCityCond = location.scope === 'CITY' ? { city: location.city2 } : {};

  const [received, assigned, cancelledReceived, recycleActivity] = await Promise.all([
    prisma.posEvent.count({ where: { actionDate: { gte: range.start, lt: range.end }, ...posEventCityCond } }),
    prisma.posEvent.count({ where: { assigningDate: { gte: range.start, lt: range.end }, ...posEventCityCond } }),
    prisma.warehouseCancelReturn.count({ where: { receivedDate: { gte: range.start, lt: range.end }, ...cancelCityCond } }),
    prisma.warehouseCancelReturn.count({ where: { receivedDate: { gte: range.start, lt: range.end }, status: 'Branding', ...cancelCityCond } })
  ]);

  return { posReceived: received, posAssigned: assigned, cancelledReceived, recycleActivity };
}
