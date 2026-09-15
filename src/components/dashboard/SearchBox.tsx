'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type AgentResult = { agentCode: string; agentName: string; team?: { name: string } | null };

export function SearchBox({
  initialQuery,
  results,
  selectedAgentCode
}: {
  initialQuery: string;
  results: AgentResult[];
  selectedAgentCode: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) router.push(`/custody?q=${encodeURIComponent(value.trim())}`);
  }

  function select(agentCode: string) {
    router.push(`/custody?q=${encodeURIComponent(value.trim())}&agent=${agentCode}`);
  }

  // Auto-open the detail view when the search matches exactly one agent.
  useEffect(() => {
    if (results.length === 1 && !selectedAgentCode) {
      select(results[0].agentCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length, selectedAgentCode]);

  return (
    <div className="card p-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input-field max-w-sm"
          placeholder="Search by Agent Code or Agent Name…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {results.length > 1 && !selectedAgentCode && (
        <div className="mt-3 border border-slate-200 rounded-md divide-y divide-slate-100 max-w-lg">
          {results.map((r) => (
            <button
              key={r.agentCode}
              onClick={() => select(r.agentCode)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between"
            >
              <span>
                <span className="font-medium text-slate-800">{r.agentCode}</span> — {r.agentName}
              </span>
              <span className="text-slate-400">{r.team?.name ?? ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
