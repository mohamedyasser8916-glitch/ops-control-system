import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  receiptSerial: string;
  receiptType: string | null;
  warehouseReceivedDate: Date | null;
  assignDate: Date | null;
  agentCode: string | null;
  agentName: string | null;
  team: string | null;
};

const VALID_TYPES = ['Deployment Receipt', 'Cancellation Receipt', 'Cash Receipt', 'Exchange Receipt'];

/**
 * NOT present in the source workbook today (only aggregate receipt counts
 * exist in Material Data) — see spec section 8H and workbook README note
 * 3. Ready the moment a serialized export is supplied.
 */
export const receiptsImporter: DatasetImporter = {
  requiredColumns: ['Receipt Serial', 'Receipt Type', 'Warehouse Received Date', 'Assign Date', 'Agent Code', 'Agent Name', 'Team'],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const receiptSerial = cellToString(row['Receipt Serial']);
    if (!receiptSerial) return { ok: false, reason: 'Missing Receipt Serial' };

    const receiptType = cellToString(row['Receipt Type']);
    if (receiptType && !VALID_TYPES.includes(receiptType)) {
      return { ok: false, reason: `Receipt Type "${receiptType}" is not one of: ${VALID_TYPES.join(', ')}` };
    }

    const agentCodeCell = cellToString(row['Agent Code']);
    const agentName = cellToString(row['Agent Name']);
    const agentCode = agentCodeCell ?? (agentName ? ctx.agentNameToCode.get(agentName) ?? null : null);

    return {
      ok: true,
      data: {
        receiptSerial,
        receiptType,
        warehouseReceivedDate: cellToDate(row['Warehouse Received Date']),
        assignDate: cellToDate(row['Assign Date']),
        agentCode,
        agentName,
        team: cellToString(row['Team'])
      }
    };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await prisma.receiptRecord.findUnique({ where: { receiptSerial: row.receiptSerial } });
      await prisma.receiptRecord.upsert({
        where: { receiptSerial: row.receiptSerial },
        create: { ...row, importBatchId },
        update: { ...row, importBatchId }
      });
      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, skipped: 0 };
  }
};
