import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getLatestPosEvents, getLoginStatsBatch } from '@/lib/posLifecycle';
import { ytdRange } from '@/lib/dates';

/**
 * Agent Custody Search — business logic (spec section 9).
 * This is a CUSTODY SEARCH TOOL, not a performance dashboard: every
 * function here answers "what does this agent currently hold / owe back",
 * never a productivity or scoring question.
 */

export async function searchAgents(query: string, limit = 20) {
  if (!query.trim()) return [];
  return prisma.agent.findMany({
    where: {
      OR: [
        { agentCode: { contains: query, mode: 'insensitive' } },
        { agentName: { contains: query, mode: 'insensitive' } }
      ]
    },
    include: { team: true, region: true, liveOps: true, teamLeader: true },
    take: limit,
    orderBy: { agentName: 'asc' }
  });
}

export async function getAgentProfile(agentCode: string) {
  return prisma.agent.findUnique({
    where: { agentCode },
    include: { team: true, region: true, liveOps: true, teamLeader: true }
  });
}

/** Current In-Hand POS (latest event per serial = Assigned, for this agent). */
export async function getCurrentInHandPos(agentCode: string) {
  const latest = await getLatestPosEvents({ agentCode });
  const inHand = latest.filter((e) => e.posStatus === 'Assigned');

  const loginStats = await getLoginStatsBatch(
    inHand.filter((e) => e.assigningDate).map((e) => ({ serialKey: e.serialKey, assigningDate: e.assigningDate as Date }))
  );

  return inHand.map((e) => ({
    serialNumber: e.serialNumber,
    serialKey: e.serialKey,
    modelType: e.modelType,
    receivedDate: e.assigningDate, // Received Date = Assigning Date, per spec
    ...(loginStats.get(e.serialKey) ?? { loginCount: 0, firstLoginDate: null, lastLoginDate: null, lastTerminalId: null })
  }));
}

/**
 * Cancelled In-Hand POS Details (spec section 9): exists in Daily Agent
 * Cancellation AND the same TID+Serial has NOT yet been physically
 * received back by the Warehouse (Warehouse Cancel). Never Serial-only.
 */
export async function getCancelledInHandPos(agentCode: string) {
  return prisma.$queryRaw<Array<{ tid: string | null; serial: string | null; cancelDate: Date | null }>>(Prisma.sql`
    SELECT d.tid, d.serial, d."cancelDate"
    FROM daily_agent_cancellation d
    WHERE d."agentCode" = ${agentCode}
      AND NOT EXISTS (
        SELECT 1 FROM warehouse_cancel_returns w WHERE w."tidSerialKey" = d."tidSerialKey"
      )
    ORDER BY d."cancelDate" DESC
  `);
}

export async function getSimDetails(agentCode: string) {
  return prisma.simRecord.findMany({
    where: { agentCode },
    select: { simSerial: true, operator: true, assignDate: true },
    orderBy: { assignDate: 'desc' }
  });
}

const RECEIPT_TYPES = ['Deployment Receipt', 'Cancellation Receipt', 'Cash Receipt', 'Exchange Receipt'] as const;

export async function getReceiptSummary(agentCode: string) {
  const receipts = await prisma.receiptRecord.findMany({
    where: { agentCode },
    select: { receiptSerial: true, receiptType: true }
  });

  return RECEIPT_TYPES.map((type) => ({
    type,
    count: receipts.filter((r) => r.receiptType === type).length,
    serials: receipts.filter((r) => r.receiptType === type).map((r) => r.receiptSerial)
  }));
}

/**
 * POS YTD Movement (spec section 9):
 *  - Total Received YTD: units received by the agent Jan 1 -> today,
 *    including currently Assigned units and units subsequently Deployed.
 *  - Current Assigned: current In-Hand POS.
 *  - Cancelled Returned YTD: Warehouse Cancel rows physically received
 *    Jan 1 -> today.
 */
export async function getPosYtdMovement(agentCode: string) {
  const { start, end } = ytdRange();

  const [receivedYtd, currentAssigned, cancelledReturnedYtd] = await Promise.all([
    prisma.posEvent.groupBy({
      by: ['serialKey'],
      where: {
        agentCode,
        assigningDate: { gte: start, lt: end },
        posStatus: { in: ['Assigned', 'Deployed'] }
      }
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count FROM (
        SELECT DISTINCT ON ("serialKey") "posStatus"
        FROM pos_events WHERE "agentCode" = ${agentCode} AND "serialKey" IS NOT NULL
        ORDER BY "serialKey", "actionDate" DESC NULLS LAST, "importedAt" DESC
      ) latest WHERE "posStatus" = 'Assigned'
    `),
    prisma.warehouseCancelReturn.count({
      where: { agentCode, receivedDate: { gte: start, lt: end } }
    })
  ]);

  return {
    totalReceivedYtd: receivedYtd.length,
    currentAssigned: Number(currentAssigned[0]?.count ?? 0),
    cancelledReturnedYtd
  };
}

/**
 * Current Custody summary counts (spec section 9): In-Hand POS, Cancelled
 * POS (in-hand, not yet returned), SIM cards, Receipts, and material
 * custody (batteries, paper rolls, chargers, cables incl. Type-C/Micro).
 * Material custody is derived the same way as the Warehouse Materials
 * dashboard: cumulative Received - Assigned, scoped to this agent.
 */
export async function getCurrentCustodySummary(agentCode: string) {
  const [inHand, cancelledInHand, simCount, receipts, materials] = await Promise.all([
    getCurrentInHandPos(agentCode),
    getCancelledInHandPos(agentCode),
    prisma.simRecord.count({ where: { agentCode } }),
    getReceiptSummary(agentCode),
    getAgentMaterialCustody(agentCode)
  ]);

  return {
    inHandPos: inHand.length,
    cancelledPos: cancelledInHand.length,
    simCards: simCount,
    receipts: receipts.reduce((sum, r) => sum + r.count, 0),
    ...materials
  };
}

async function getAgentMaterialCustody(agentCode: string) {
  const rows = await prisma.materialMovement.groupBy({
    by: ['materialType', 'orderType'],
    where: { agentCode },
    _sum: { qty: true }
  });

  const netByType = new Map<string, number>();
  for (const r of rows) {
    const current = netByType.get(r.materialType) ?? 0;
    const delta = Number(r._sum.qty ?? 0) * (r.orderType === 'Assigned' ? 1 : 0); // custody = assigned to agent, not yet consumed
    netByType.set(r.materialType, current + delta);
  }

  const pick = (names: string[]) => names.reduce((sum, n) => sum + (netByType.get(n) ?? 0), 0);

  return {
    batteries: pick(['A920 Battery', 'A920 Pro Battery']),
    paperRolls: pick(['Paper Roll (Paymob)']),
    chargers: pick(['Adapter']),
    cablesTotal: pick(['Cable Type C', 'Cable Type Micro', 'Type.C Cable', 'Micro Cable']),
    cablesTypeC: pick(['Cable Type C', 'Type.C Cable']),
    cablesMicro: pick(['Cable Type Micro', 'Micro Cable'])
  };
}

/**
 * Clearance (spec section 9): Agent Checkpoint audit date has passed and
 * the agent still has equipment not returned to the Warehouse. For
 * cancelled POS this reuses the TID+Serial match, never Serial alone.
 */
export async function getClearanceStatus(agentCode: string) {
  const checkpoints = await prisma.agentCheckpoint.findMany({
    where: { agentCode, auditDate: { lte: new Date() } },
    orderBy: { auditDate: 'desc' }
  });

  if (checkpoints.length === 0) {
    return { hasDueAudit: false, outstandingInHandPos: [], outstandingCancelledPos: [] };
  }

  const [inHand, cancelledInHand] = await Promise.all([getCurrentInHandPos(agentCode), getCancelledInHandPos(agentCode)]);

  return {
    hasDueAudit: true,
    lastAuditDate: checkpoints[0].auditDate,
    outstandingInHandPos: inHand,
    outstandingCancelledPos: cancelledInHand
  };
}
