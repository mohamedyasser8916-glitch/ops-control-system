import { prisma } from '@/lib/db';
import type { DateRange } from '@/lib/dates';

/**
 * Warehouse Materials dashboard — business logic (spec section 11).
 *
 * The category grouping below maps the 30+ raw "Material Type" values
 * found in the real source data onto the headline categories the spec
 * asks for. This mapping is a documented business-rule assumption (see
 * README "Business Rule Assumptions") — confirm with operations if a new
 * material type doesn't fit any bucket; it falls into "Other" rather than
 * being silently dropped.
 */
export const MATERIAL_CATEGORIES: Record<string, string[]> = {
  'Paper Rolls': ['Paper Roll (Paymob)'],
  'Chargers / Adapters': ['Adapter', 'Recycle Adapter'],
  Batteries: ['A920 Battery', 'A920 Pro Battery'],
  'Cables (Type-C)': ['Cable Type C', 'Type.C Cable'],
  'Cables (Micro)': ['Cable Type Micro', 'Micro Cable', 'Recycle Cable'],
  'SIM Cards': ['Vodafone SIMS', 'Etisalat SIMS', 'Orange SIMS', 'WE SIMS', 'WE SIM Card', 'Vodafone SIM Card', 'Etisalat SIM Card', 'Recycle SIM'],
  Boxes: ['BM Boxes', 'Recycle Box'],
  Receipts: ['Cancellation Receipts', 'Deploy Receipts', 'Cash Receipts', 'Replacement Receipts'],
  'Marketing Materials': ['A920 Brochure', 'Hot-Line Stickers', 'Door Stickers'],
  'Box Stickers': ['Branded POS Stickers', 'Front Box Sticker', 'Back Box Sticker', 'Right Side Box Sticker', 'Left Side Box Sticker', 'Small Box Sticker']
};

function categoryOf(materialType: string): string {
  for (const [category, types] of Object.entries(MATERIAL_CATEGORIES)) {
    if (types.includes(materialType)) return category;
  }
  return 'Other';
}

export type MaterialStockRow = {
  category: string;
  materialType: string;
  currentStock: number;
  assignedYtd: number;
  receivedYtd: number;
};

export async function getMaterialsStockTable(ytd: DateRange): Promise<MaterialStockRow[]> {
  const [allTime, ytdRows] = await Promise.all([
    prisma.materialMovement.groupBy({ by: ['materialType', 'orderType'], _sum: { qty: true } }),
    prisma.materialMovement.groupBy({
      by: ['materialType', 'orderType'],
      where: { moveDate: { gte: ytd.start, lt: ytd.end } },
      _sum: { qty: true }
    })
  ]);

  const materialTypes = new Set<string>();
  const allTimeMap = new Map<string, { received: number; assigned: number }>();
  for (const r of allTime) {
    materialTypes.add(r.materialType);
    const e = allTimeMap.get(r.materialType) ?? { received: 0, assigned: 0 };
    if (r.orderType === 'Received') e.received += Number(r._sum.qty ?? 0);
    if (r.orderType === 'Assigned') e.assigned += Number(r._sum.qty ?? 0);
    allTimeMap.set(r.materialType, e);
  }

  const ytdMap = new Map<string, { received: number; assigned: number }>();
  for (const r of ytdRows) {
    const e = ytdMap.get(r.materialType) ?? { received: 0, assigned: 0 };
    if (r.orderType === 'Received') e.received += Number(r._sum.qty ?? 0);
    if (r.orderType === 'Assigned') e.assigned += Number(r._sum.qty ?? 0);
    ytdMap.set(r.materialType, e);
  }

  return Array.from(materialTypes)
    .map((materialType) => {
      const allTimeEntry = allTimeMap.get(materialType) ?? { received: 0, assigned: 0 };
      const ytdEntry = ytdMap.get(materialType) ?? { received: 0, assigned: 0 };
      return {
        category: categoryOf(materialType),
        materialType,
        currentStock: allTimeEntry.received - allTimeEntry.assigned,
        assignedYtd: ytdEntry.assigned,
        receivedYtd: ytdEntry.received
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.materialType.localeCompare(b.materialType));
}

export function summarizeByCategory(rows: MaterialStockRow[]) {
  const map = new Map<string, { currentStock: number; assignedYtd: number; receivedYtd: number }>();
  for (const r of rows) {
    const e = map.get(r.category) ?? { currentStock: 0, assignedYtd: 0, receivedYtd: 0 };
    e.currentStock += r.currentStock;
    e.assignedYtd += r.assignedYtd;
    e.receivedYtd += r.receivedYtd;
    map.set(r.category, e);
  }
  return Array.from(map.entries()).map(([category, v]) => ({ category, ...v }));
}

export async function getMaterialsMtdActivity(mtd: DateRange) {
  const rows = await prisma.materialMovement.groupBy({
    by: ['orderType'],
    where: { moveDate: { gte: mtd.start, lt: mtd.end } },
    _sum: { qty: true }
  });
  const assigned = rows.find((r) => r.orderType === 'Assigned');
  const received = rows.find((r) => r.orderType === 'Received');
  return { assignedMtd: Number(assigned?._sum.qty ?? 0), receivedMtd: Number(received?._sum.qty ?? 0) };
}
