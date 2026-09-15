import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * POS Lifecycle core helper (spec section 12).
 *
 * pos_events is an EVENT LOG: the same physical Serial Number can appear in
 * many rows over its life (received, assigned, deployed, cancelled,
 * re-assigned, ...). This was confirmed against the real workbook: 6,194
 * rows cover only 5,315 distinct serials.
 *
 * "Current state" of a unit is always the row with the latest actionDate
 * for that serialKey (ties broken by import order). We compute this with
 * PostgreSQL's DISTINCT ON, which uses the (serialKey, actionDate) index
 * and stays fast even at millions of rows — this is deliberately raw SQL
 * rather than an application-side reduce, so it never has to load the
 * full history into Node to find the latest row.
 */
export type LatestPosEventRow = {
  id: string;
  serialNumber: string;
  serialKey: string;
  modelType: string | null;
  category: string | null;
  posStatus: string | null;
  stockStatus: string | null;
  agentCode: string | null;
  assignedTeam: string | null;
  assigningName: string | null;
  assigningDate: Date | null;
  deploymentDate: Date | null;
  actionDate: Date | null;
  tid: string | null;
  mid: string | null;
  city: string | null;
  city2: string | null;
  region: string | null;
};

const LATEST_EVENT_COLUMNS = `
  id, "serialNumber", "serialKey", "modelType", category, "posStatus", "stockStatus",
  "agentCode", "assignedTeam", "assigningName", "assigningDate", "deploymentDate",
  "actionDate", tid, mid, city, city2, region
`;

/** Latest lifecycle event for every serial (i.e. current fleet state). Optionally scoped to one agent or one city. */
export async function getLatestPosEvents(opts: { agentCode?: string; city2?: string } = {}): Promise<LatestPosEventRow[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`"serialKey" IS NOT NULL`];
  if (opts.agentCode) conditions.push(Prisma.sql`"agentCode" = ${opts.agentCode}`);
  if (opts.city2) conditions.push(Prisma.sql`"city2" = ${opts.city2}`);

  const where = Prisma.join(conditions, ' AND ');

  return prisma.$queryRaw<LatestPosEventRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("serialKey") ${Prisma.raw(LATEST_EVENT_COLUMNS)}
    FROM pos_events
    WHERE ${where}
    ORDER BY "serialKey", "actionDate" DESC NULLS LAST, "importedAt" DESC
  `);
}

/** Latest event for a single serial — used by the POS lifecycle trace view. */
export async function getLatestEventForSerial(serialKey: string): Promise<LatestPosEventRow | null> {
  const rows = await prisma.$queryRaw<LatestPosEventRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("serialKey") ${Prisma.raw(LATEST_EVENT_COLUMNS)}
    FROM pos_events
    WHERE "serialKey" = ${serialKey}
    ORDER BY "serialKey", "actionDate" DESC NULLS LAST, "importedAt" DESC
  `);
  return rows[0] ?? null;
}

/** Full historical trace of every event for one serial, oldest first. */
export async function getPosHistory(serialKey: string) {
  return prisma.posEvent.findMany({
    where: { serialKey },
    orderBy: [{ actionDate: 'asc' }, { importedAt: 'asc' }]
  });
}

/**
 * Terminal Login matching (spec section 8E / 9).
 * Only counts login rows with deployment_date >= the unit's CURRENT
 * Assigning Date — i.e. logins that belong to the current assignment, not
 * a previous agent's use of the same physical terminal.
 */
export async function getLoginStatsForSerial(serialKey: string, assigningDate: Date | null) {
  if (!assigningDate) {
    return { loginCount: 0, firstLoginDate: null as Date | null, lastLoginDate: null as Date | null, lastTerminalId: null as string | null };
  }

  const stats = await prisma.$queryRaw<Array<{ login_count: bigint; first_login: Date | null; last_login: Date | null }>>(Prisma.sql`
    SELECT count(*)::bigint AS login_count, min("deploymentDate") AS first_login, max("deploymentDate") AS last_login
    FROM terminal_login
    WHERE "serialKey" = ${serialKey} AND "deploymentDate" >= ${assigningDate}
  `);

  const row = stats[0];
  if (!row || Number(row.login_count) === 0) {
    return { loginCount: 0, firstLoginDate: null, lastLoginDate: null, lastTerminalId: null };
  }

  const last = await prisma.terminalLogin.findFirst({
    where: { serialKey, deploymentDate: row.last_login! },
    orderBy: { importedAt: 'desc' }
  });

  return {
    loginCount: Number(row.login_count),
    firstLoginDate: row.first_login,
    lastLoginDate: row.last_login,
    lastTerminalId: last?.terminalId ?? null
  };
}

/** Batch version for a set of serials — used by the In-Hand POS Details table so we issue 1 query, not N. */
export async function getLoginStatsBatch(serials: Array<{ serialKey: string; assigningDate: Date }>) {
  if (serials.length === 0) return new Map<string, { loginCount: number; firstLoginDate: Date | null; lastLoginDate: Date | null; lastTerminalId: string | null }>();

  // Dates are passed as ISO date strings (not JS Date objects) so the
  // array is unambiguously serialized by the driver before Postgres casts
  // it to timestamp[] — avoids relying on driver-specific Date[] handling.
  const rows = await prisma.$queryRaw<Array<{ serial_key: string; login_count: bigint; first_login: Date | null; last_login: Date | null; last_terminal_id: string | null }>>(Prisma.sql`
    WITH targets (serial_key, assigning_date) AS (
      SELECT * FROM UNNEST(
        ${serials.map((s) => s.serialKey)}::text[],
        ${serials.map((s) => s.assigningDate.toISOString())}::timestamp[]
      )
    ),
    matched AS (
      SELECT t.serial_key, tl."deploymentDate", tl."terminalId"
      FROM targets t
      JOIN terminal_login tl ON tl."serialKey" = t.serial_key AND tl."deploymentDate" >= t.assigning_date
    ),
    agg AS (
      SELECT serial_key, count(*)::bigint AS login_count, min("deploymentDate") AS first_login, max("deploymentDate") AS last_login
      FROM matched GROUP BY serial_key
    )
    SELECT a.*, (
      SELECT m."terminalId" FROM matched m WHERE m.serial_key = a.serial_key AND m."deploymentDate" = a.last_login LIMIT 1
    ) AS last_terminal_id
    FROM agg a
  `);

  const map = new Map<string, { loginCount: number; firstLoginDate: Date | null; lastLoginDate: Date | null; lastTerminalId: string | null }>();
  for (const r of rows) {
    map.set(r.serial_key, {
      loginCount: Number(r.login_count),
      firstLoginDate: r.first_login,
      lastLoginDate: r.last_login,
      lastTerminalId: r.last_terminal_id
    });
  }
  return map;
}
