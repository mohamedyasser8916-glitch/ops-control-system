import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Management Overview (spec section 28): a navigation placeholder only.
 * No fabricated executive KPIs â€” real cross-module summaries will be
 * built here once Agent Performance, Deployment, Cancellation, Closing
 * and Budget have confirmed business logic.
 */
export default async function OverviewPage() {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_OVERVIEW)) {
    return <EmptyState title="You don't have access to the Management Overview." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Management Overview</h1>
        <p className="text-sm text-slate-500">A cross-module summary will appear here in a future phase.</p>
      </div>

      <div className="card p-8">
        <EmptyState
          title="Coming in a future phase"
          description="The Management Overview will summarize approved KPIs from Agent Performance, Deployment, Cancellation, Warehouse, Materials, Live Ops, Attendance, Closing and Budget once those modules' business logic is confirmed. In the meantime, use Agent Custody Search and the Warehouse dashboards from the sidebar."
        />
      </div>
    </div>
  );
}

