import { EmptyState } from '@/components/ui/EmptyState';

export default function ComingSoonPage({ searchParams }: { searchParams: { m?: string } }) {
  const moduleName = searchParams.m ?? 'This module';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">{moduleName}</h1>
      </div>
      <div className="card p-8">
        <EmptyState
          title="Coming in a future phase"
          description={`${moduleName} is on the roadmap. The navigation, permissions and database structure are already prepared for it — the dashboard itself will be built once the exact business rules and KPI formulas are confirmed.`}
        />
      </div>
    </div>
  );
}
