import { prisma } from '@/lib/db';
import { cellToString } from '@/lib/importers/parseFile';
import type { DatasetImporter, ImportRowResult } from '@/lib/importers/types';

type Row = {
  agentCode: string;
  agentName: string;
  team: string | null;
  region: string | null;
  liveOps: string | null;
  teamLeader: string | null;
  status: string;
};

const STATUS_MAP: Record<string, 'ACTIVE' | 'INACTIVE' | 'TERMINATED'> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  terminated: 'TERMINATED'
};

export const agentMasterImporter: DatasetImporter = {
  requiredColumns: ['Agent Code', 'Agent Name', 'Team', 'Region', 'Live Ops', 'Team Leader', 'Status'],

  transformRow(row, rowNumber): ImportRowResult<Row> {
    const agentCode = cellToString(row['Agent Code']);
    const agentName = cellToString(row['Agent Name']);
    if (!agentCode) return { ok: false, reason: 'Missing Agent Code' };
    if (!agentName) return { ok: false, reason: 'Missing Agent Name' };

    const statusRaw = (cellToString(row['Status']) ?? 'Active').toLowerCase();
    const status = STATUS_MAP[statusRaw] ?? 'ACTIVE';

    return {
      ok: true,
      data: {
        agentCode,
        agentName,
        team: cellToString(row['Team']),
        region: cellToString(row['Region']),
        liveOps: cellToString(row['Live Ops']),
        teamLeader: cellToString(row['Team Leader']),
        status
      }
    };
  },

  async persist(rowsUnknown) {
    const rows = rowsUnknown as Row[];
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const [team, region, liveOps, teamLeader] = await Promise.all([
        row.team ? prisma.team.upsert({ where: { name: row.team }, create: { name: row.team }, update: {} }) : null,
        row.region ? prisma.region.upsert({ where: { name: row.region }, create: { name: row.region }, update: {} }) : null,
        row.liveOps ? prisma.liveOps.upsert({ where: { name: row.liveOps }, create: { name: row.liveOps }, update: {} }) : null,
        row.teamLeader ? prisma.teamLeader.upsert({ where: { name: row.teamLeader }, create: { name: row.teamLeader }, update: {} }) : null
      ]);

      const existing = await prisma.agent.findUnique({ where: { agentCode: row.agentCode } });

      await prisma.agent.upsert({
        where: { agentCode: row.agentCode },
        create: {
          agentCode: row.agentCode,
          agentName: row.agentName,
          teamId: team?.id,
          regionId: region?.id,
          liveOpsId: liveOps?.id,
          teamLeaderId: teamLeader?.id,
          status: row.status as any
        },
        update: {
          agentName: row.agentName,
          teamId: team?.id ?? null,
          regionId: region?.id ?? null,
          liveOpsId: liveOps?.id ?? null,
          teamLeaderId: teamLeader?.id ?? null,
          status: row.status as any
        }
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, skipped: 0 };
  }
};
