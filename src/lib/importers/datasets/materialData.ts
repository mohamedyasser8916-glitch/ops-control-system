import { prisma } from '@/lib/db';
import { cellToDate, cellToNumber, cellToString } from '@/lib/importers/parseFile';
import { hashRow, assignOccurrenceIndexes } from '@/lib/hash';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  moveDate: Date | null;
  orderType: string;
  materialType: string;
  qty: number;
  agentCode: string | null;
  team: string | null;
  agentName: string | null;
  vendorName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

export const materialDataImporter: DatasetImporter = {
  requiredColumns: ['Date', 'Order', 'Material Type', 'Count'],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const orderType = cellToString(row['Order']);
    const materialType = cellToString(row['Material Type']);
    if (!orderType || (orderType !== 'Received' && orderType !== 'Assigned')) {
      return { ok: false, reason: `Order must be "Received" or "Assigned", got "${orderType}"` };
    }
    if (!materialType) return { ok: false, reason: 'Missing Material Type' };

    const agentName = cellToString(row['Agent Name']);
    const agentCode = agentName ? ctx.agentNameToCode.get(agentName) ?? null : null;

    return {
      ok: true,
      data: {
        moveDate: cellToDate(row['Date']),
        orderType,
        materialType,
        qty: cellToNumber(row['Count']) ?? 0,
        agentCode,
        team: cellToString(row['Team']),
        agentName,
        vendorName: cellToString(row['Vendor Name']),
        city: cellToString(row['City']),
        region: cellToString(row['Region']),
        country: cellToString(row['Country'])
      }
    };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    const withHash = assignOccurrenceIndexes(rows, (r) =>
      hashRow([r.moveDate?.toISOString() ?? '', r.orderType, r.materialType, r.agentName, r.team, r.vendorName, r.qty])
    );

    const result = await prisma.materialMovement.createMany({
      data: withHash.map((r) => ({
        importBatchId,
        sourceRowHash: r.__hash,
        occurrenceIndex: r.__occurrenceIndex,
        moveDate: r.moveDate,
        orderType: r.orderType,
        materialType: r.materialType,
        qty: r.qty,
        agentCode: r.agentCode,
        team: r.team,
        agentName: r.agentName,
        vendorName: r.vendorName,
        city: r.city,
        region: r.region,
        country: r.country
      })),
      skipDuplicates: true
    });

    return { inserted: result.count, updated: 0, skipped: rows.length - result.count };
  }
};
