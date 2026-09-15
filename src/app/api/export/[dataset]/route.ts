import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { getMaterialsStockTable } from '@/lib/materials';
import { getStockOverview } from '@/lib/warehousePos';
import { ytdRange } from '@/lib/dates';
import { writeAuditLog } from '@/lib/audit';

/**
 * Controlled export endpoint (spec section 37). Every export is
 * permission-checked and audited — sensitive datasets (payroll, budget)
 * are intentionally NOT wired up here yet; they require
 * export_sensitive_data once those modules exist.
 */
export async function GET(req: NextRequest, { params }: { params: { dataset: string } }) {
  const session = await getAppSession();
  if (!session || !hasPermission(session, PERMISSIONS.EXPORT_DATA)) {
    return NextResponse.json({ error: 'You do not have permission to export data.' }, { status: 403 });
  }

  let rows: Record<string, unknown>[] = [];

  switch (params.dataset) {
    case 'warehouse-pos-stock': {
      const location = req.nextUrl.searchParams.get('city');
      const stock = await getStockOverview(location && location !== 'EGY' ? { scope: 'CITY', city2: location } : { scope: 'EGY' });
      rows = stock;
      break;
    }
    case 'warehouse-materials-stock': {
      rows = await getMaterialsStockTable(ytdRange());
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown export dataset "${params.dataset}"` }, { status: 400 });
  }

  await writeAuditLog({ userId: session.user.id, action: 'EXPORT', entity: params.dataset });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${params.dataset}.csv"`
    }
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}
