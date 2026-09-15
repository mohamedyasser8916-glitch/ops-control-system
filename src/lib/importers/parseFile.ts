import * as XLSX from 'xlsx';

/**
 * Reads the first worksheet of an uploaded .xlsx/.xls/.csv file into an
 * array of plain objects keyed by column header (trimmed).
 *
 * This is the ONLY place file parsing happens — every dataset importer
 * receives already-parsed rows, so adding a new source format later
 * (OneDrive / Microsoft Graph — see docs/onedrive-integration.md) only
 * means producing the same row shape here, nothing downstream changes.
 */
export function parseSpreadsheet(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`"${fileName}" has no worksheets.`);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });

  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key.trim()] = value;
    }
    return clean;
  });
}

/** Normalizes a cell to a trimmed string, or null. Strips the ".0" artifact Excel/JS leaves on whole numbers read as floats. */
export function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  const str = String(value).trim();
  if (str === '') return null;
  // "708913.0" -> "708913" (common artifact when a numeric ID column has blanks elsewhere in the sheet)
  const floatArtifact = /^-?\d+\.0+$/;
  return floatArtifact.test(str) ? str.split('.')[0] : str;
}

export function cellToDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function cellToNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function assertColumns(row: Record<string, unknown>, required: string[], fileName: string) {
  const missing = required.filter((c) => !(c in row));
  if (missing.length > 0) {
    throw new Error(`"${fileName}" is missing required column(s): ${missing.join(', ')}`);
  }
}
