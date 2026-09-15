import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  simSerial: string;
  operator: string | null;
  warehouseReceivedDate: Date | null;
  assignDate: Date | null;
  agentCode: string | null;
  agentName: string | null;
  team: string | null;
};

const VALID_OPERATORS = ['Vodafone', 'Etisalat', 'WE', 'Orange'];

/**
 * NOT present in the source workbook today (only aggregate SIM counts
 * exist in Material Data) — see spec section 8G and workbook README note
 * 4. Ready the moment a serialized export is supplied.
 */
export const simDataImporter: DatasetImporter = {
  requiredColumns: ['SIM Serial', 'Operator', 'Warehouse Received Date', 'Assign Date', 'Agent Code', 'Agent Name', 'Team'],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const simSerial = cellToString(row['SIM Serial']);
    if (!simSerial) return { ok: false, reason: 'Missing SIM Serial' };

    const operator = cellToString(row['Operator']);
    if (operator && !VALID_OPERATORS.includes(operator)) {
      return { ok: false, reason: `Operator "${operator}" is not one of: ${VALID_OPERATORS.join(', ')}` };
    }

    const agentCodeCell = cellToString(row['Agent Code']);
    const agentName = cellToString(row['Agent Name']);
    const agentCode = agentCodeCell ?? (agentName ? ctx.agentNameToCode.get(agentName) ?? null : null);

    return {
      ok: true,
      data: {
        simSerial,
        operator,
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
      const existing = await prisma.simRecord.findUnique({ where: { simSerial: row.simSerial } });
      await prisma.simRecord.upsert({
        where: { simSerial: row.simSerial },
        create: { ...row, importBatchId },
        update: { ...row, importBatchId }
      });
      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, skipped: 0 };
  }
};
