import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { getMaterialsStockTable, summarizeByCategory, getMaterialsMtdActivity } from '@/lib/materials';
import { ytdRange, mtdRange } from '@/lib/dates';
import { KpiCard } from '@/components/ui/KpiCard';

export default async function WarehouseMaterialsPage() {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_WAREHOUSE)) {
    return <div className="text-sm text-slate-500">You don't have access to the Warehouse dashboards.</div>;
  }

  const [rows, mtdActivity] = await Promise.all([getMaterialsStockTable(ytdRange()), getMaterialsMtdActivity(mtdRange())]);
  const byCategory = summarizeByCategory(rows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Warehouse Materials</h1>
        <p className="text-sm text-slate-500">Current stock and movement for consumables and accessories.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 max-w-md">
        <KpiCard label="Assigned MTD" value={mtdActivity.assignedMtd} />
        <KpiCard label="Received MTD" value={mtdActivity.receivedMtd} />
      </div>

      <section className="card p-4">
        <h2 className="section-title mb-3">By Category</h2>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Current Stock</th>
                <th className="text-right">Assigned YTD</th>
                <th className="text-right">Received YTD</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category}>
                  <td className="font-medium text-slate-800">{c.category}</td>
                  <td className="text-right">{c.currentStock}</td>
                  <td className="text-right">{c.assignedYtd}</td>
                  <td className="text-right">{c.receivedYtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Material Detail</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="table-base">
            <thead className="sticky top-0">
              <tr>
                <th>Category</th>
                <th>Material</th>
                <th className="text-right">Current Stock</th>
                <th className="text-right">Assigned YTD</th>
                <th className="text-right">Received YTD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.materialType}>
                  <td className="text-slate-500">{r.category}</td>
                  <td>{r.materialType}</td>
                  <td className="text-right">{r.currentStock}</td>
                  <td className="text-right">{r.assignedYtd}</td>
                  <td className="text-right">{r.receivedYtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

