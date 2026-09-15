'use server';

import { revalidatePath } from 'next/cache';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

/**
 * Fills in Region / Live Ops / Team Leader for an agent (spec section 6 /
 * workbook README note 2 — these fields do not exist in the source data
 * yet and are edited here manually until an upstream source supplies
 * them). Every change is written to AgentAssignmentHistory so historical
 * organizational changes are never lost (spec section 6).
 */
export async function updateAgentOrgFields(formData: FormData) {
  const session = await getAppSession();
  if (!session || !hasPermission(session, PERMISSIONS.MANAGE_AGENTS)) {
    throw new Error('You do not have permission to manage Agent Master.');
  }

  const agentCode = String(formData.get('agentCode'));
  const regionName = (formData.get('region') as string)?.trim() || null;
  const liveOpsName = (formData.get('liveOps') as string)?.trim() || null;
  const teamLeaderName = (formData.get('teamLeader') as string)?.trim() || null;
  const status = formData.get('status') as string;

  const before = await prisma.agent.findUniqueOrThrow({
    where: { agentCode },
    include: { region: true, liveOps: true, teamLeader: true }
  });

  const [region, liveOps, teamLeader] = await Promise.all([
    regionName ? prisma.region.upsert({ where: { name: regionName }, create: { name: regionName }, update: {} }) : null,
    liveOpsName ? prisma.liveOps.upsert({ where: { name: liveOpsName }, create: { name: liveOpsName }, update: {} }) : null,
    teamLeaderName ? prisma.teamLeader.upsert({ where: { name: teamLeaderName }, create: { name: teamLeaderName }, update: {} }) : null
  ]);

  await prisma.agent.update({
    where: { agentCode },
    data: {
      regionId: region?.id ?? null,
      liveOpsId: liveOps?.id ?? null,
      teamLeaderId: teamLeader?.id ?? null,
      status: (status as any) ?? before.status
    }
  });

  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [
    { field: 'region', oldValue: before.region?.name ?? null, newValue: regionName },
    { field: 'liveOps', oldValue: before.liveOps?.name ?? null, newValue: liveOpsName },
    { field: 'teamLeader', oldValue: before.teamLeader?.name ?? null, newValue: teamLeaderName },
    { field: 'status', oldValue: before.status, newValue: status }
  ].filter((c) => c.oldValue !== c.newValue);

  if (changes.length > 0) {
    await prisma.agentAssignmentHistory.createMany({
      data: changes.map((c) => ({ agentCode, fieldChanged: c.field, oldValue: c.oldValue, newValue: c.newValue, effectiveFrom: new Date() }))
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Agent',
      recordId: agentCode,
      oldValue: changes.map((c) => ({ [c.field]: c.oldValue })),
      newValue: changes.map((c) => ({ [c.field]: c.newValue }))
    });
  }

  revalidatePath('/admin/agents');
}
