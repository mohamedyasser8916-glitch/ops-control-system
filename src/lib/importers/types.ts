export type ImportRowResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export type ImportRunResult = {
  rowsRead: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsRejected: number;
  rejectedSamples: Array<{ rowNumber: number; rawData: Record<string, unknown>; reason: string }>;
};

/** A dataset importer knows how to validate one raw row and how to persist a validated batch. */
export interface DatasetImporter {
  requiredColumns: string[];
  /** Validate + transform ONE raw spreadsheet row. Return a rejection reason instead of throwing wherever possible, so one bad row never aborts the whole file. */
  transformRow(row: Record<string, unknown>, rowNumber: number, ctx: ImportContext): Promise<ImportRowResult<unknown>> | ImportRowResult<unknown>;
  /** Persist the whole validated batch (transaction-friendly bulk upserts). Returns insert/update/skip counts. */
  persist(rows: unknown[], importBatchId: string): Promise<{ inserted: number; updated: number; skipped: number }>;
}

/** Shared lookups a transformRow implementation may need (e.g. Agent Name -> Agent Code). */
export type ImportContext = {
  agentNameToCode: Map<string, string>;
};
