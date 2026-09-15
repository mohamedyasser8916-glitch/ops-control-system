import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getAvailableCities,
  getStockOverview,
  summarizeStockKpis,
  getDeploymentBreakdown,
  getCancellationReceived,
  getWarehouseActivity,
  type LocationFilter
} from '@/lib/warehousePos';
import { monthRange, ytdRange, mtdRange } from '@/lib/dates';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { WarehouseFilters } from '@/components/dashboard/WarehouseFilters';

export default async function WarehousePosPage({ searchParams }: { searchParams: { city?: string; month?: string } }) {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_WAREHOUSE)) {
    return <EmptyState title="You don't have access to the Warehouse dashboards." />;
  }

  const cities = await getAvailableCities();
  const location: LocationFilter = searchParams.city && searchParams.city !== 'EGY' ? { scope: 'CITY', city2: searchParams.city } : { scope: 'EGY' };

  const now = new Date();
  const [year, month] = (searchParams.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
  const selectedMonthRange = monthRange(year, month);

  const [stockRows, deploymentSelectedMonth, deploymentMtd, deploymentYtd, cancellationReceived, activity] = await Promise.all([
    getStockOverview(location),
    getDeploymentBreakdown(location, selectedMonthRange),
    getDeploymentBreakdown(location, mtdRange()),
    getDeploymentBreakdown(location, ytdRange()),
    getCancellationReceived(location, ytdRange()),
    getWarehouseActivity(location, mtdRange())
  ]);

  const kpis = summarizeStockKpis(stockRows);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-navy-900">Warehouse POS</h1>
          <p className="text-sm text-slate-500">Stock overview, deployment, and warehouse activity for POS terminals.</p>
        </div>
        <WarehouseFilters cities={cities} selectedCity={searchParams.city ?? 'EGY'} selectedMonth={searchParams.month ?? `${year}-${String(month).padStart(2, '0')}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Ready POS" value={kpis.ready} />
        <KpiCard label="Not Ready POS" value={kpis.notReady} />
        <KpiCard label="In-Hand POS" value={kpis.inHand} />
        <KpiCard label="Total POS" value={kpis.total} />
      </div>

      <section className="card p-4">
        <h2 className="section-title mb-3">POS Stock Overview</h2>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">In-Stock</th>
                <th className="text-right">Login</th>
                <th className="text-right">Recycle</th>
                <th className="text-right">Broken</th>
                <th className="text-right">In-Hand FSA</th>
                <th className="text-right">In-Hand Sales</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r) => {
                const total = r.inStock + r.login + r.recycle + r.broken + r.inHandFsa + r.inHandSales;
                return (
                  <tr key={r.model}>
                    <td className="font-medium text-slate-800">{r.model}</td>
                    <td className="text-right">{r.inStock}</td>
                    <td className="text-right">{r.login}</td>
                    <td className="text-right">{r.recycle}</td>
                    <td className="text-right">{r.broken}</td>
                    <td className="text-right">{r.inHandFsa}</td>
                    <td className="text-right">{r.inHandSales}</td>
                    <td className="text-right font-medium">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Deployment Breakdown</h2>
        <DeploymentTabs monthLabel={searchParams.month ?? ''} selectedMonth={deploymentSelectedMonth} mtd={deploymentMtd} ytd={deploymentYtd} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="section-title mb-3">Cancellation Received (YTD)</h2>
          <p className="text-xs text-slate-500 mb-2">Machines physically received by the Warehouse â€” not agent cancellation activity.</p>
          {cancellationReceived.length === 0 ? (
            <EmptyState title="No cancellations received in this period." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {cancellationReceived.map((r) => (
                  <tr key={r.model}>
                    <td>{r.model}</td>
                    <td className="text-right">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">POS Warehouse Activity (MTD)</h2>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="POS Received" value={activity.posReceived} />
            <KpiCard label="POS Assigned" value={activity.posAssigned} />
            <KpiCard label="Cancelled Received" value={activity.cancelledReceived} />
            <KpiCard label="Recycle Activity" value={activity.recycleActivity} />
          </div>
        </section>
      </div>
    </div>
  );
}

function DeploymentTabs({
  monthLabel,
  selectedMonth,
  mtd,
  ytd
}: {
  monthLabel: string;
  selectedMonth: Awaited<ReturnType<typeof getDeploymentBreakdown>>;
  mtd: Awaited<ReturnType<typeof getDeploymentBreakdown>>;
  ytd: Awaited<ReturnType<typeof getDeploymentBreakdown>>;
}) {
  const sections: Array<{ title: string; rows: typeof selectedMonth }> = [
    { title: `Selected Month${monthLabel ? ` (${monthLabel})` : ''}`, rows: selectedMonth },
    { title: 'MTD', rows: mtd },
    { title: 'YTD', rows: ytd }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {sections.map((s) => (
        <div key={s.title}>
          <div className="text-xs font-medium text-slate-500 mb-2">{s.title}</div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">FSA</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Total</th>
                <th className="text-right">FSA %</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.model}>
                  <td>{r.model}</td>
                  <td className="text-right">{r.deployedFsa}</td>
                  <td className="text-right">{r.deployedSales}</td>
                  <td className="text-right font-medium">{r.totalDeployed}</td>
                  <td className="text-right">{r.fsaPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

