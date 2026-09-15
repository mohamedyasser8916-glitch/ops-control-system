import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { DATASET_LABELS } from '@/lib/importers/registry';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ImportUploadForm } from '@/components/dashboard/ImportUploadForm';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function DataManagementPage() {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_DATA_MANAGEMENT)) {
    return <EmptyState title="You don't have access to Data Management." />;
  }

  const canImport = hasPermission(session, PERMISSIONS.MANAGE_IMPORTS);

  const [batches, datasetSummaries] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { triggeredBy: { select: { name: true } } }
    }),
    Promise.all(
      Object.keys(DATASET_LABELS).map(async (dataset) => {
        const latest = await prisma.importBatch.findFirst({
          where: { dataset: dataset as any, status: { in: ['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'] } },
          orderBy: { finishedAt: 'desc' }
        });
        return { dataset, latest };
      })
    )
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Data Management</h1>
        <p className="text-sm text-slate-500">Upload source files and review import history for every dataset.</p>
      </div>

      {canImport && <ImportUploadForm />}

      <section className="card p-4">
        <h2 className="section-title mb-3">Datasets</h2>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Last Sync</th>
                <th className="text-right">Rows Inserted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {datasetSummaries.map(({ dataset, latest }) => (
                <tr key={dataset}>
                  <td className="font-medium text-slate-800">{DATASET_LABELS[dataset as keyof typeof DATASET_LABELS]}</td>
                  <td>{latest?.finishedAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(latest.finishedAt) : 'â€”'}</td>
                  <td className="text-right">{latest?.rowsInserted ?? 'â€”'}</td>
                  <td>{latest ? <StatusBadge status={latest.status} /> : <span className="text-xs text-slate-400">Never imported</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Import History</h2>
        {batches.length === 0 ? (
          <EmptyState title="No imports yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>File</th>
                  <th>Started</th>
                  <th className="text-right">Read</th>
                  <th className="text-right">Inserted</th>
                  <th className="text-right">Updated</th>
                  <th className="text-right">Skipped</th>
                  <th className="text-right">Rejected</th>
                  <th>Status</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>{DATASET_LABELS[b.dataset]}</td>
                    <td className="max-w-[180px] truncate">{b.fileName}</td>
                    <td>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(b.startedAt)}</td>
                    <td className="text-right">{b.rowsRead}</td>
                    <td className="text-right">{b.rowsInserted}</td>
                    <td className="text-right">{b.rowsUpdated}</td>
                    <td className="text-right">{b.rowsSkipped}</td>
                    <td className="text-right">{b.rowsRejected}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>{b.triggeredBy?.name ?? 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

