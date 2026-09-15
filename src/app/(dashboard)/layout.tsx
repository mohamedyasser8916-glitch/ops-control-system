import { getAppSession } from '@/lib/session';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { prisma } from '@/lib/db';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();

  if (!session) { throw new Error('MARKER_TEST_9137'); }

  const lastImport = await prisma.importBatch.findFirst({
    where: { status: { in: ['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'] } },
    orderBy: { finishedAt: 'desc' }
  });

  const lastRefresh = lastImport?.finishedAt
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(lastImport.finishedAt)
    : null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar permissions={session.user.permissions} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar userName={session.user.name} roleName={session.user.roleName} lastRefresh={lastRefresh} />
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
