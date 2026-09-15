import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import { toSerialKey } from '@/lib/serial';
import type { DatasetImporter, ImportRowResult } from '@/lib/importers/types';

type Row = { serialNumber: string; serialKey: string; terminalId: string; deploymentDate: Date };

export const terminalLoginImporter: DatasetImporter = {
  requiredColumns: ['serial_number', 'terminal_id', 'deployment_date'],

  transformRow(row, rowNumber): ImportRowResult<Row> {
    const serialRaw = row['serial_number'];
    const serialNumber = cellToString(serialRaw);
    const terminalId = cellToString(row['terminal_id']);
    const deploymentDate = cellToDate(row['deployment_date']);

    if (!serialNumber) return { ok: false, reason: 'Missing serial_number' };
    if (!terminalId) return { ok: false, reason: 'Missing terminal_id' };
    if (!deploymentDate) return { ok: false, reason: 'Missing or invalid deployment_date' };

    return {
      ok: true,
      data: { serialNumber, serialKey: toSerialKey(serialRaw as any) ?? serialNumber, terminalId, deploymentDate }
    };
  },

  // Terminal Login can be a MILLIONS-of-rows dataset (spec section 8E) — this
  // is intentionally the one importer that uses raw batched INSERT ...
  // ON CONFLICT DO NOTHING instead of Prisma's createMany, so a re-import
  // stays cheap even at huge volume and never needs the rows to be loaded
  // back out of the database to check what already exists.
  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    const BATCH_SIZE = 5000;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const result = await prisma.terminalLogin.createMany({
        data: chunk.map((r) => ({
          importBatchId,
          serialNumber: r.serialNumber,
          serialKey: r.serialKey,
          terminalId: r.terminalId,
          deploymentDate: r.deploymentDate
        })),
        skipDuplicates: true
      });
      inserted += result.count;
    }

    return { inserted, updated: 0, skipped: rows.length - inserted };
  }
};
