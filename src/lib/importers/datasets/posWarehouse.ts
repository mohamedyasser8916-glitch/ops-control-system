import { prisma } from '@/lib/db';
import { cellToDate, cellToString } from '@/lib/importers/parseFile';
import { toSerialKey } from '@/lib/serial';
import { hashRow, assignOccurrenceIndexes } from '@/lib/hash';
import type { DatasetImporter, ImportContext, ImportRowResult } from '@/lib/importers/types';

type Row = {
  actionDate: Date | null;
  posSource: string | null;
  serialNumber: string;
  serialKey: string;
  imei: string | null;
  imei2: string | null;
  posType: string | null;
  boxNumber: string | null;
  category: string | null;
  modelType: string | null;
  paymob: string | null;
  sahlOrNot: string | null;
  cibOrNot: string | null;
  posStatus: string | null;
  agentCode: string | null;
  assignedTeam: string | null;
  assigningName: string | null;
  assigningDate: Date | null;
  deploymentDate: Date | null;
  mid: string | null;
  tid: string | null;
  receiptNumber: string | null;
  receiptDate: Date | null;
  city: string | null;
  zone: string | null;
  address: string | null;
  comment: string | null;
  stockStatus: string | null;
  tidVal: string | null;
  city2: string | null;
  region: string | null;
  country: string | null;
};

export const posWarehouseImporter: DatasetImporter = {
  requiredColumns: [
    'Action Date', 'Serial Number', 'POS Status', 'Assigned Team', 'Assigning Date', 'Stock Status'
  ],

  transformRow(row, rowNumber, ctx: ImportContext): ImportRowResult<Row> {
    const serialNumberRaw = row['Serial Number'];
    const serialNumber = cellToString(serialNumberRaw);
    if (!serialNumber) return { ok: false, reason: 'Missing Serial Number' };

    const assigningName = cellToString(row['Assigning Name']);
    const agentCode = assigningName ? ctx.agentNameToCode.get(assigningName) ?? null : null;

    return {
      ok: true,
      data: {
        actionDate: cellToDate(row['Action Date']),
        posSource: cellToString(row['POS Source'] ?? row['  POS Source ']),
        serialNumber,
        serialKey: toSerialKey(serialNumberRaw as any) ?? serialNumber,
        imei: cellToString(row['IMEI']),
        imei2: cellToString(row['IMEI 2']),
        posType: cellToString(row['POS Type'] ?? row['POS  Type']),
        boxNumber: cellToString(row['Box Number']),
        category: cellToString(row['Category']),
        modelType: cellToString(row['Model Type']),
        paymob: cellToString(row['Paymob']),
        sahlOrNot: cellToString(row['SAHL or Not']),
        cibOrNot: cellToString(row['CIB OR NOT']),
        posStatus: cellToString(row['POS Status']),
        agentCode,
        assignedTeam: cellToString(row['Assigned Team']),
        assigningName,
        assigningDate: cellToDate(row['Assigning Date']),
        deploymentDate: cellToDate(row['Deployment Date']),
        mid: cellToString(row['MID']),
        tid: cellToString(row['TID']),
        receiptNumber: cellToString(row['Receipt Number']),
        receiptDate: cellToDate(row['Receipt Date']),
        city: cellToString(row['City']),
        zone: cellToString(row['Zone']),
        address: cellToString(row['Address'] ?? row['Addrees']),
        comment: cellToString(row['Comment']),
        stockStatus: cellToString(row['Stock Status']),
        tidVal: cellToString(row['TID Val']),
        city2: cellToString(row['City2']),
        region: cellToString(row['Region']),
        country: cellToString(row['Country'])
      }
    };
  },

  async persist(rowsUnknown, importBatchId) {
    const rows = rowsUnknown as Row[];

    // Content hash excludes lineage fields — see src/lib/hash.ts for why.
    const withHash = assignOccurrenceIndexes(rows, (r) =>
      hashRow([r.serialNumber, r.actionDate?.toISOString() ?? '', r.posStatus, r.assigningDate?.toISOString() ?? '', r.tid, r.mid])
    );

    const result = await prisma.posEvent.createMany({
      data: withHash.map((r) => ({
        importBatchId,
        sourceRowHash: r.__hash,
        occurrenceIndex: r.__occurrenceIndex,
        actionDate: r.actionDate,
        posSource: r.posSource,
        serialNumber: r.serialNumber,
        serialKey: r.serialKey,
        imei: r.imei,
        imei2: r.imei2,
        posType: r.posType,
        boxNumber: r.boxNumber,
        category: r.category,
        modelType: r.modelType,
        paymob: r.paymob,
        sahlOrNot: r.sahlOrNot,
        cibOrNot: r.cibOrNot,
        posStatus: r.posStatus,
        agentCode: r.agentCode,
        assignedTeam: r.assignedTeam,
        assigningName: r.assigningName,
        assigningDate: r.assigningDate,
        deploymentDate: r.deploymentDate,
        mid: r.mid,
        tid: r.tid,
        receiptNumber: r.receiptNumber,
        receiptDate: r.receiptDate,
        city: r.city,
        zone: r.zone,
        address: r.address,
        comment: r.comment,
        stockStatus: r.stockStatus,
        tidVal: r.tidVal,
        city2: r.city2,
        region: r.region,
        country: r.country
      })),
      skipDuplicates: true
    });

    const skipped = rows.length - result.count;
    return { inserted: result.count, updated: 0, skipped };
  }
};
