import { createHash } from 'crypto';

/**
 * Import idempotency (spec section 40).
 *
 * None of the raw event-style sheets (POS Warehouse, Warehouse Cancel,
 * Material Data, Daily Agent Cancellation) carry a stable per-row ID in the
 * source system today. Inventing an artificial key (like row order) would
 * be dangerous — it would silently duplicate every row on every re-import.
 *
 * Instead we hash the row's *business* fields (excluding anything derived
 * at import time, like lineage columns). Re-importing the exact same file
 * produces the exact same hashes, so already-seen rows are skipped
 * automatically (upsert-by-hash).
 *
 * A very small number of source rows are genuinely identical to another
 * row in the same file (confirmed on the real sample: 2 out of 1000
 * Material Data rows). To avoid silently merging two distinct real
 * events into one, each row's key is (hash, occurrenceIndex), where
 * occurrenceIndex is that row's 1-based rank among same-hash rows *within
 * that file, in file order*. Re-importing the same file therefore lines
 * up occurrence-for-occurrence and stays idempotent, while true duplicate
 * rows within one file are still both kept.
 */
export function hashRow(fields: Array<string | number | null | undefined>): string {
  const normalized = fields.map((f) => (f === null || f === undefined ? '' : String(f))).join('');
  return createHash('sha256').update(normalized).digest('hex');
}

/** Assigns an occurrenceIndex per hash, in the order rows appear in the file. */
export function assignOccurrenceIndexes<T>(rows: T[], hashOf: (row: T) => string): Array<T & { __hash: string; __occurrenceIndex: number }> {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const hash = hashOf(row);
    const next = (seen.get(hash) ?? 0) + 1;
    seen.set(hash, next);
    return { ...row, __hash: hash, __occurrenceIndex: next };
  });
}
