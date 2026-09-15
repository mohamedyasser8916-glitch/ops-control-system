import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { updateAgentOrgFields } from '@/lib/actions/agentActions';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AgentMasterPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.MANAGE_AGENTS)) {
    return <EmptyState title="You don't have access to Agent Master." />;
  }

  const q = searchParams.q?.trim();
  const agents = await prisma.agent.findMany({
    where: q ? { OR: [{ agentCode: { contains: q, mode: 'insensitive' } }, { agentName: { contains: q, mode: 'insensitive' } }] } : undefined,
    include: { team: true, region: true, liveOps: true, teamLeader: true },
    orderBy: { agentName: 'asc' },
    take: 100
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Agent Master</h1>
        <p className="text-sm text-slate-500">
          Region, Live Ops and Team Leader are not present in the current source data â€” fill them in below; every dashboard
          picks up the change automatically. Agent Code and Agent Name come from imports and are read-only here.
        </p>
      </div>

      <form className="max-w-sm">
        <input name="q" defaultValue={q} placeholder="Search Agent Code or Nameâ€¦" className="input-field" />
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Agent Code</th>
              <th>Agent Name</th>
              <th>Team</th>
              <th>Region</th>
              <th>Live Ops</th>
              <th>Team Leader</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.agentCode}>
                <td className="font-medium">{agent.agentCode}</td>
                <td className="max-w-[220px] truncate">{agent.agentName}</td>
                <td>{agent.team?.name ?? 'â€”'}</td>
                <td colSpan={4} className="p-0">
                  <form action={updateAgentOrgFields} className="flex items-center gap-2 py-1 px-3">
                    <input type="hidden" name="agentCode" value={agent.agentCode} />
                    <input name="region" defaultValue={agent.region?.name ?? ''} placeholder="Region" className="input-field w-28 text-xs py-1" />
                    <input name="liveOps" defaultValue={agent.liveOps?.name ?? ''} placeholder="Live Ops" className="input-field w-28 text-xs py-1" />
                    <input name="teamLeader" defaultValue={agent.teamLeader?.name ?? ''} placeholder="Team Leader" className="input-field w-32 text-xs py-1" />
                    <select name="status" defaultValue={agent.status} className="input-field w-28 text-xs py-1">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                    <button type="submit" className="btn-secondary text-xs py-1 px-2">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

