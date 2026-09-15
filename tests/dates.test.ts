import { describe, it, expect } from 'vitest';
import { mtdRange, ytdRange, monthRange } from '@/lib/dates';

describe('date range helpers', () => {
  it('mtdRange starts on the 1st of the reference month and ends the day after the reference date', () => {
    const ref = new Date(Date.UTC(2026, 8, 15)); // 15 Sep 2026
    const { start, end } = mtdRange(ref);
    expect(start.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(end.toISOString().slice(0, 10)).toBe('2026-09-16'); // end-exclusive
  });

  it('ytdRange starts on Jan 1st of the reference year', () => {
    const ref = new Date(Date.UTC(2026, 8, 15));
    const { start, end } = ytdRange(ref);
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(end.toISOString().slice(0, 10)).toBe('2026-09-16');
  });

  it('monthRange covers exactly one calendar month, end-exclusive', () => {
    const { start, end } = monthRange(2026, 2); // February (29 days in 2026? check leap year)
    expect(start.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(end.toISOString().slice(0, 10)).toBe('2026-03-01');
  });
});
