import { describe, it, expect } from 'vitest';
import { hashRow, assignOccurrenceIndexes } from '@/lib/hash';

describe('hashRow', () => {
  it('produces the same hash for the same fields (idempotent re-import)', () => {
    const a = hashRow(['serial-1', '2026-01-01', 'Assigned', '2026-01-01', 'tid-1', 'mid-1']);
    const b = hashRow(['serial-1', '2026-01-01', 'Assigned', '2026-01-01', 'tid-1', 'mid-1']);
    expect(a).toBe(b);
  });

  it('produces a different hash when any field changes', () => {
    const a = hashRow(['serial-1', '2026-01-01', 'Assigned', '2026-01-01', 'tid-1', 'mid-1']);
    const b = hashRow(['serial-1', '2026-01-02', 'Assigned', '2026-01-01', 'tid-1', 'mid-1']);
    expect(a).not.toBe(b);
  });

  it('treats null and undefined the same as empty string (avoids false differences on optional columns)', () => {
    const a = hashRow(['x', null]);
    const b = hashRow(['x', undefined]);
    expect(a).toBe(b);
  });
});

describe('assignOccurrenceIndexes', () => {
  it('gives unique rows occurrenceIndex = 1', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const result = assignOccurrenceIndexes(rows, (r) => r.id);
    expect(result.map((r) => r.__occurrenceIndex)).toEqual([1, 1]);
  });

  it('increments occurrenceIndex for true duplicate rows within the same file, in file order', () => {
    // This is the exact scenario found in the real Material Data sheet:
    // two rows with 100% identical business fields.
    const rows = [{ id: 'dup' }, { id: 'dup' }, { id: 'dup' }];
    const result = assignOccurrenceIndexes(rows, (r) => r.id);
    expect(result.map((r) => r.__occurrenceIndex)).toEqual([1, 2, 3]);
    // and re-processing the SAME file again reproduces the same indexes,
    // so a re-import of the identical file is a no-op (upsert skips it)
    const reprocessed = assignOccurrenceIndexes(rows, (r) => r.id);
    expect(reprocessed.map((r) => r.__occurrenceIndex)).toEqual([1, 2, 3]);
  });
});
