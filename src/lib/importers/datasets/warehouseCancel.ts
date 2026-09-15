import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import { toSerialKey, toTidSerialKey } from '@/lib/serial';
import { hashRow, assignOccurrenceIndexes } from '@/lib/hash';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  receivedDate: Date | null;
  serial: string;
  serialKey: string;
  imei: string | null;
  mid: string | null;
  tid: string | null;
  status: string | null;
  cancellationOrExchange: string | null;
  cancellationDate: Date | null;
  receiptNumber: string | null;
  agentCode: string | null;
  team: string | null;
  name: string | null;
  box: string | null;
  cable: string | null;
  sim: string | null;
  adapter: string | null;
  modelType: string | null;
  paymob: string | null;
  cibOrNot: string | null;
  comment: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  tidSerialKey: string;
};

export const warehouseCancelImporter: DatasetImporter = {
  requiredColumns: ['Recieved Date', 'Serial', 'TID', 'Status'],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const serialRaw = row['Serial'];
    const serial = cellToString(serialRaw);
    if (!serial) return { ok: false, reason: 'Missing Serial' };

    const name = cellToString(row['Name']);
    const agentCode = name ? ctx.agentNameToCode.get(name) ?? null : null;
    const tid = cellToString(row['TID']);

    return {
      ok: true,
      data: {
        receivedDate: cellToDate(row['Recieved Date'] ?? row['Received Date']),
        serial,
        serialKey: toSerialKey(serialRaw as any) ?? serial,
        imei: cellToString(row['IMEI']),
        mid: cellToString(row['MID']),
        tid,
        status: cellToString(row['Status']),
        cancellationOrExchange: cellToString(row['Cancellation or Exchange']),
        cancellationDate: cellToDate(row['Cancellation Date']),
        receiptNumber: cellToString(row['Receipt Number']),
        agentCode,
        team: cellToString(row['Team']),
        name,
        box: cellToString(row['Box']),
        cable: cellToString(row['Cable']),
        sim: cellToString(row['SIM']),
        adapter: cellToString(row['Adapter']),
        modelType: cellToString(row['Model Type']),
        paymob: cellToString(row['Paymob']),
        cibOrNot: cellToString(row['CIB OR NOT']),
        comment: cellToString(row['Comment']),
        city: cellToString(row['City']),
        region: cellToString(row['Region']),
        country: cellToString(row['Country']),
        tidSerialKey: toTidSerialKey(tid, serialRaw as any)
      }
    };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];
    const withHash = assignOccurrenceIndexes(rows, (r) =>
      hashRow([r.serial, r.receivedDate?.toISOString() ?? '', r.tid, r.status])
    );

    const result = await prisma.warehouseCancelReturn.createMany({
      data: withHash.map((r) => ({
        importBatchId,
        sourceRowHash: r.__hash,
        occurrenceIndex: r.__occurrenceIndex,
        receivedDate: r.receivedDate,
        serial: r.serial,
        serialKey: r.serialKey,
        imei: r.imei,
        mid: r.mid,
        tid: r.tid,
        status: r.status,
        cancellationOrExchange: r.cancellationOrExchange,
        cancellationDate: r.cancellationDate,
        receiptNumber: r.receiptNumber,
        agentCode: r.agentCode,
        team: r.team,
        name: r.name,
        box: r.box,
        cable: r.cable,
        sim: r.sim,
        adapter: r.adapter,
        modelType: r.modelType,
        paymob: r.paymob,
        cibOrNot: r.cibOrNot,
        comment: r.comment,
        city: r.city,
        region: r.region,
        country: r.country,
        tidSerialKey: r.tidSerialKey
      })),
      skipDuplicates: true
    });

    return { inserted: result.count, updated: 0, skipped: rows.length - result.count };
  }
};
