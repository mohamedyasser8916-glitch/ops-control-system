/**
 * Centralized date-range logic (spec section 7 — "Do not implement
 * different date logic independently in every dashboard").
 *
 * Every dashboard filter (Selected Month / MTD / YTD / Custom Range) goes
 * through these helpers so the definitions can never drift apart between
 * Agent Custody, Warehouse POS and Warehouse Materials.
 */

export type DateRange = { start: Date; end: Date };

/** Start of today in UTC, end-exclusive ranges throughout (end = start of the day AFTER the last included day). */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** Month-to-date: from the 1st of the current month through today (inclusive). */
export function mtdRange(reference: Date = today()): DateRange {
  return { start: startOfMonth(reference), end: addDays(reference, 1) };
}

/** Year-to-date: from Jan 1st through today (inclusive). */
export function ytdRange(reference: Date = today()): DateRange {
  return { start: startOfYear(reference), end: addDays(reference, 1) };
}

/** A specific calendar month (e.g. the Month filter on Warehouse POS). */
export function monthRange(year: number, month1to12: number): DateRange {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end = new Date(Date.UTC(year, month1to12, 1));
  return { start, end };
}

export function customRange(start: Date, end: Date): DateRange {
  return { start, end: addDays(end, 1) };
}

export function formatISODate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}
