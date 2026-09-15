import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import {
  searchAgents,
  getAgentProfile,
  getCurrentCustodySummary,
  getPosYtdMovement,
  getCurrentInHandPos,
  getCancelledInHandPos,
  getSimDetails,
  getReceiptSummary,
  getClearanceStatus
} from '@/lib/custody';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBox } from '@/components/dashboard/SearchBox';

function formatDate(d: Date | null | undefined) {
  if (!d) return 'â€”';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

export default async function AgentCustodyPage({ searchParams }: { searchParams: { q?: string; agent?: string } }) {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.VIEW_AGENT_CUSTODY)) {
    return <EmptyState title="You don't have access to Agent Custody Search." description="Ask an administrator to grant the view_agent_custody permission." />;
  }

  const query = searchParams.q ?? '';
  const selectedAgentCode = searchParams.agent ?? null;
  const results = query ? await searchAgents(query) : [];

  const agent = selectedAgentCode ? await getAgentProfile(selectedAgentCode) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Agent Custody Search</h1>
        <p className="text-sm text-slate-500">Search an agent to see what they currently hold and owe back to the Warehouse.</p>
      </div>

      <SearchBox initialQuery={query} results={results} selectedAgentCode={selectedAgentCode} />

      {!agent && query && results.length === 0 && (
        <EmptyState title={`No agent found matching "${query}"`} description="Try the Agent Code or part of the Agent Name." />
      )}

      {agent && <AgentCustodyDetail agentCode={agent.agentCode} />}
    </div>
  );
}

async function AgentCustodyDetail({ agentCode }: { agentCode: string }) {
  const [agent, custody, ytd, inHand, cancelledInHand, sim, receipts, clearance] = await Promise.all([
    getAgentProfile(agentCode),
    getCurrentCustodySummary(agentCode),
    getPosYtdMovement(agentCode),
    getCurrentInHandPos(agentCode),
    getCancelledInHandPos(agentCode),
    getSimDetails(agentCode),
    getReceiptSummary(agentCode),
    getClearanceStatus(agentCode)
  ]);

  if (!agent) return null;

  return (
    <div className="space-y-6">
      {/* Agent header */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-6 gap-4">
        <Field label="Agent Code" value={agent.agentCode} />
        <Field label="Agent Name" value={agent.agentName} />
        <Field label="Team" value={agent.team?.name ?? 'â€”'} />
        <Field label="Region" value={agent.region?.name ?? 'â€”'} />
        <Field label="Live Ops" value={agent.liveOps?.name ?? 'â€”'} />
        <Field label="Team Leader" value={agent.teamLeader?.name ?? 'â€”'} />
      </div>

      {/* Current Custody */}
      <section>
        <h2 className="section-title mb-2">Current Custody</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard label="In-Hand POS" value={custody.inHandPos} />
          <KpiCard label="Cancelled POS" value={custody.cancelledPos} />
          <KpiCard label="SIM Cards" value={custody.simCards} />
          <KpiCard label="Receipts" value={custody.receipts} />
          <KpiCard label="Batteries" value={custody.batteries} />
          <KpiCard label="Paper Rolls" value={custody.paperRolls} />
          <KpiCard label="Chargers" value={custody.chargers} />
          <KpiCard label="Cables (Total)" value={custody.cablesTotal} sub={`Type-C: ${custody.cablesTypeC} Â· Micro: ${custody.cablesMicro}`} />
        </div>
      </section>

      {/* POS YTD Movement */}
      <section>
        <h2 className="section-title mb-2">POS YTD Movement</h2>
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <KpiCard label="Total POS Received YTD" value={ytd.totalReceivedYtd} />
          <KpiCard label="Current Assigned" value={ytd.currentAssigned} />
          <KpiCard label="Cancelled Returned YTD" value={ytd.cancelledReturnedYtd} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In-Hand POS Details */}
        <section className="card p-4">
          <h2 className="section-title mb-3">In-Hand POS Details</h2>
          {inHand.length === 0 ? (
            <EmptyState title="No POS currently in hand." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Serial Number</th>
                    <th>Received Date</th>
                    <th>Login Count</th>
                    <th>Terminal ID</th>
                  </tr>
                </thead>
                <tbody>
                  {inHand.map((row) => (
                    <tr key={row.serialKey}>
                      <td>{row.serialNumber}</td>
                      <td>{formatDate(row.receivedDate)}</td>
                      <td>{row.loginCount}</td>
                      <td>{row.lastTerminalId ?? 'â€”'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cancelled POS Details */}
        <section className="card p-4">
          <h2 className="section-title mb-3">Cancelled POS Details (not yet returned)</h2>
          {cancelledInHand.length === 0 ? (
            <EmptyState
              title="No cancelled POS outstanding."
              description="This will populate once the Daily Agent Cancellation export is imported (see Data Management)."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>TID</th>
                    <th>Serial</th>
                    <th>Cancellation Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledInHand.map((row, i) => (
                    <tr key={i}>
                      <td>{row.tid ?? 'â€”'}</td>
                      <td>{row.serial ?? 'â€”'}</td>
                      <td>{formatDate(row.cancelDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SIM Details */}
        <section className="card p-4">
          <h2 className="section-title mb-3">SIM Details</h2>
          {sim.length === 0 ? (
            <EmptyState title="No SIM cards on record." description="Requires a serialized SIM Data import." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>SIM Serial</th>
                    <th>Operator</th>
                    <th>Assign Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.map((s) => (
                    <tr key={s.simSerial}>
                      <td>{s.simSerial}</td>
                      <td>{s.operator ?? 'â€”'}</td>
                      <td>{formatDate(s.assignDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Receipts â€” one compact area */}
        <section className="card p-4">
          <h2 className="section-title mb-3">Receipts</h2>
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r.type} className="flex items-start justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-600">{r.type}</span>
                <div className="text-right">
                  <div className="font-medium text-slate-800">{r.count}</div>
                  {r.serials.length > 0 && <div className="text-xs text-slate-400 max-w-xs truncate">{r.serials.join(', ')}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Clearance */}
      <section className="card p-4">
        <h2 className="section-title mb-3">Clearance</h2>
        {!clearance.hasDueAudit ? (
          <EmptyState title="No clearance audit currently due." description="Populated from Agent Checkpoint once audit dates are imported." />
        ) : clearance.outstandingInHandPos.length === 0 && clearance.outstandingCancelledPos.length === 0 ? (
          <div className="text-sm text-emerald-700">
            Audit due ({formatDate(clearance.lastAuditDate)}) â€” all equipment has been returned to the Warehouse.
          </div>
        ) : (
          <div className="text-sm">
            <p className="text-amber-700 mb-2">
              Audit due ({formatDate(clearance.lastAuditDate)}) â€” the following equipment has not been returned:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              {clearance.outstandingInHandPos.map((p) => (
                <li key={`ih-${p.serialKey}`}>In-Hand POS: {p.serialNumber}</li>
              ))}
              {clearance.outstandingCancelledPos.map((p, i) => (
                <li key={`c-${i}`}>Cancelled (not returned): TID {p.tid} / Serial {p.serial}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

