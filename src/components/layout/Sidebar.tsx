'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '@/components/layout/navConfig';
import type { PermissionKey } from '@/lib/permissions';
import clsx from 'clsx';

export function Sidebar({ permissions }: { permissions: PermissionKey[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-navy-950 text-navy-100 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-navy-800">
        <div className="text-white font-semibold text-sm tracking-wide">OPERATIONS</div>
        <div className="text-navy-400 text-xs">CONTROL SYSTEM</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => permissions.includes(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-4">
              <div className="px-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-500">{group.title}</div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href.split('?')[0]));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2 px-5 py-2 text-sm transition-colors',
                      isActive ? 'bg-navy-800 text-white border-r-2 border-accent-500' : 'text-navy-300 hover:bg-navy-900 hover:text-white'
                    )}
                  >
                    {item.label}
                    {item.future && <span className="ml-auto text-[10px] text-navy-500 border border-navy-700 rounded px-1">soon</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
