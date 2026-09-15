import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import { toSerialKey, toTidSerialKey } from '@/lib/serial';
import { hashRow, assignOccurrenceIndexes } from '@/lib/hash';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  team: string | null;
  region: string | null;
  city: string | null;
  tid: string | null;
  mid: string | null;
  cancelDate: Date | null;
  imei: string | null;
  serial: string | null;
  serialKey: string | null;
  posModel: string | null;
  agentCode: string | null;
  agentName: string | null;
  source: string | null;
  ticketId: string | null;
  comment: string | null;
  warehouseReceived: boolean;
  tidSerialKey: string | null;
};

/**
 * This dataset was NOT included in the source workbook (see spec section
 * 8F and workbook README note 5) — it is the only source for "POS
 * cancelled by an agent but not yet physically returned to the
 * Warehouse". The importer is fully built and ready; it simply has
 * nothing to import until this daily export is supplied.
 */
export const dailyCancellationImporter: DatasetImporter = {
  requiredColumns: ['Team', 'Region', 'City', 'TID', 'MID', 'Date', 'IMEI', 'Serial', 'POS Model', 'Agent Code', 'Agent Name', 'Source', 'Ticket ID'],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const tid = cellToString(row['TID']);
    const serialRaw = row['Serial'];
    const serial = cellToString(serialRaw);

    const agentCodeCell = cellToString(row['Agent Code']);
    const agentName = cellToString(row['Agent Name']);
    const agentCode = agentCodeCell ?? (agentName ? ctx.agentNameToCode.get(agentName) ?? null : null);

    return {
      ok: true,
      data: {
        team: cellToString(row['Team']),
        region: cellToString(row['Region']),
        city: cellToString(row['City']),
        tid,
        mid: cellToString(row['MID']),
        cancelDate: cellToDate(row['Date']),
        imei: cellToString(row['IMEI']),
        serial,
        serialKey: serial ? toSerialKey(serialRaw as any) : null,
        posModel: cellToString(row['POS Model']),
        agentCode,
        agentName,
        source: cellToString(row['Source']),
        ticketId: cellToString(row['Ticket ID']),
        comment: cellToString(row['Comment']),
        warehouseReceived: Boolean(row['warehouse received']),
        tidSerialKey: tid || serial ? toTidSerialKey(tid, serialRaw as any) : null
      }
    };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    const withHash = assignOccurrenceIndexes(rows, (r) =>
      hashRow([r.tid, r.serial, r.cancelDate?.toISOString() ?? '', r.ticketId, r.agentCode])
    );

    const result = await prisma.dailyAgentCancellation.createMany({
      data: withHash.map((r) => ({
        importBatchId,
        sourceRowHash: r.__hash,
        occurrenceIndex: r.__occurrenceIndex,
        team: r.team,
        region: r.region,
        city: r.city,
        tid: r.tid,
        mid: r.mid,
        cancelDate: r.cancelDate,
        imei: r.imei,
        serial: r.serial,
        serialKey: r.serialKey,
        posModel: r.posModel,
        agentCode: r.agentCode,
        agentName: r.agentName,
        source: r.source,
        ticketId: r.ticketId,
        comment: r.comment,
        warehouseReceived: r.warehouseReceived,
        tidSerialKey: r.tidSerialKey
      })),
      skipDuplicates: true
    });

    return { inserted: result.count, updated: 0, skipped: rows.length - result.count };
  }
};
