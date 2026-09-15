import { prisma } from '@/lib/db';
import { ImportDataset } from '@prisma/client';
import { parseSpreadsheet } from '@/lib/importers/parseFile';
import type { DatasetImporter, ImportContext, ImportRunResult } from '@/lib/importers/types';
import { DATASET_IMPORTERS } from '@/lib/importers/registry';

/**
 * Generic import pipeline (spec section 4):
 *   Source File -> Validate -> Transform -> Upsert -> PostgreSQL -> Log Result
 *
 * Every dataset flows through this single function so behavior (batch
 * logging, rejected-row capture, idempotency) can never diverge between
 * datasets. Dataset-specific logic lives only in
 * src/lib/importers/datasets/*.ts (see DatasetImporter).
 */
export async function runImport(opts: {
  dataset: ImportDataset;
  fileName: string;
  fileBuffer: Buffer;
  sourceLabel: string;
  triggeredById?: string;
}): Promise<{ batchId: string; result: ImportRunResult }> {
  const importer: DatasetImporter = DATASET_IMPORTERS[opts.dataset];
  if (!importer) throw new Error(`No importer registered for dataset ${opts.dataset}`);

  const batch = await prisma.importBatch.create({
    data: {
      dataset: opts.dataset,
      sourceLabel: opts.sourceLabel,
      fileName: opts.fileName,
      triggeredById: opts.triggeredById,
      status: 'RUNNING'
    }
  });

  const result: ImportRunResult = { rowsRead: 0, rowsInserted: 0, rowsUpdated: 0, rowsSkipped: 0, rowsRejected: 0, rejectedSamples: [] };

  try {
    const rawRows = parseSpreadsheet(opts.fileBuffer, opts.fileName);
    result.rowsRead = rawRows.length;

    if (rawRows.length > 0) {
      const missing = importer.requiredColumns.filter((c) => !(c in rawRows[0]));
      if (missing.length > 0) {
        throw new Error(`Missing required column(s): ${missing.join(', ')}. Found columns: ${Object.keys(rawRows[0]).join(', ')}`);
      }
    }

    const agents = await prisma.agent.findMany({ select: { agentCode: true, agentName: true } });
    const ctx: ImportContext = { agentNameToCode: new Map(agents.map((a) => [a.agentName.trim(), a.agentCode])) };

    const validRows: unknown[] = [];
    const rejectedRows: Array<{ rowNumber: number; rawData: Record<string, unknown>; reason: string }> = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // account for the header row
      try {
        const validated = await importer.transformRow(rawRows[i], rowNumber, ctx);
        if (validated.ok) {
          validRows.push(validated.data);
        } else {
          rejectedRows.push({ rowNumber, rawData: rawRows[i], reason: validated.reason });
        }
      } catch (err) {
        rejectedRows.push({ rowNumber, rawData: rawRows[i], reason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    result.rowsRejected = rejectedRows.length;
    result.rejectedSamples = rejectedRows.slice(0, 200);

    if (rejectedRows.length > 0) {
      await prisma.importRejectedRow.createMany({
        data: rejectedRows.slice(0, 2000).map((r) => ({
          importBatchId: batch.id,
          rowNumber: r.rowNumber,
          rawData: r.rawData as any,
          reason: r.reason
        }))
      });
    }

    const { inserted, updated, skipped } = await importer.persist(validRows, batch.id);
    result.rowsInserted = inserted;
    result.rowsUpdated = updated;
    result.rowsSkipped = skipped;

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        finishedAt: new Date(),
        rowsRead: result.rowsRead,
        rowsInserted: result.rowsInserted,
        rowsUpdated: result.rowsUpdated,
        rowsSkipped: result.rowsSkipped,
        rowsRejected: result.rowsRejected,
        status: result.rowsRejected > 0 ? 'SUCCEEDED_WITH_ERRORS' : 'SUCCEEDED'
      }
    });

    return { batchId: batch.id, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown import error';
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { finishedAt: new Date(), status: 'FAILED', errorSummary: message, rowsRead: result.rowsRead }
    });
    throw err;
  }
}
