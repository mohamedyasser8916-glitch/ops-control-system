import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import type { DatasetImporter, ImportRowResult } from '@/lib/importers/types';

type Row = { agentCode: string; auditDate: Date };

/**
 * NOT present in the source workbook today (spec section 8I / workbook
 * README note 6) — powers the Clearance section of Agent Custody Search
 * once audit dates are supplied.
 */
export const agentCheckpointImporter: DatasetImporter = {
  requiredColumns: ['Agent Code', 'Audit Date'],

  transformRow(row, rowNumber): ImportRowResult<Row> {
    const agentCode = cellToString(row['Agent Code']);
    const auditDate = cellToDate(row['Audit Date']);
    if (!agentCode) return { ok: false, reason: 'Missing Agent Code' };
    if (!auditDate) return { ok: false, reason: 'Missing or invalid Audit Date' };
    return { ok: true, data: { agentCode, auditDate } };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    const result = await prisma.agentCheckpoint.createMany({
      data: rows.map((r) => ({ agentCode: r.agentCode, auditDate: r.auditDate, importBatchId })),
      skipDuplicates: true
    });
    return { inserted: result.count, updated: 0, skipped: rows.length - result.count };
  }
};
