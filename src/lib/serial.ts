/**
 * Serial Number normalization.
 *
 * The source workbook stores POS "Serial Number" as an Excel NUMBER, which
 * silently drops leading zeros (e.g. "0821747085" becomes 821747085), while
 * the Terminal Login export stores serial_number as TEXT and keeps the
 * leading zero. To reliably match a POS unit to its terminal login history,
 * both sides are normalized to the same "Serial Key":
 *
 *   - purely numeric values -> zero-padded to 10 digits
 *   - anything else (e.g. "V9E0012100") -> trimmed + uppercased, unchanged
 *
 * This exact rule was reverse-engineered from the workbook's own helper
 * column and confirmed against the real sample data (zero mismatches).
 * Business rule reference: spec section 8E / workbook README note 7.
 */
export function toSerialKey(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '') return null;

  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const asInt = Math.trunc(Number(str));
    if (Number.isFinite(asInt) && asInt >= 0) {
      return String(asInt).padStart(10, '0');
    }
  }
  return str.toUpperCase();
}

/** Business match key for Warehouse Cancel Return matching: TID + Serial (never Serial alone). */
export function toTidSerialKey(tid: string | number | null | undefined, serial: string | number | null | undefined): string {
  const tidPart = tid === null || tid === undefined || String(tid).trim() === '' ? '' : String(tid).trim();
  const serialKey = toSerialKey(serial) ?? '';
  return `${tidPart}|${serialKey}`;
}
