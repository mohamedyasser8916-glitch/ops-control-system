'use client';

import { signOut } from 'next-auth/react';

export function Topbar({ userName, roleName, lastRefresh }: { userName: string; roleName: string; lastRefresh: string | null }) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="text-sm text-slate-500">
        {lastRefresh ? (
          <span>
            Last data refresh: <span className="font-medium text-slate-700">{lastRefresh}</span>
          </span>
        ) : (
          <span className="text-amber-600">No data imported yet</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-800">{userName}</div>
          <div className="text-xs text-slate-500">{roleName}</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary text-xs px-3 py-1.5">
          Sign out
        </button>
      </div>
    </header>
  );
}
