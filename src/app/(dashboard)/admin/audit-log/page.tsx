import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AuditLogPage() {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_AUDIT_LOG)) {
    return <EmptyState title="You don't have access to the audit log." />;
  }

  const entries = await prisma.auditLog.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Every master-data change, import and user/role change is recorded here.</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No audit entries yet." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'medium' }).format(e.createdAt)}</td>
                  <td>{e.user?.name ?? 'System'}</td>
                  <td>{e.action}</td>
                  <td>{e.entity}</td>
                  <td className="max-w-[220px] truncate">{e.recordId ?? 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

