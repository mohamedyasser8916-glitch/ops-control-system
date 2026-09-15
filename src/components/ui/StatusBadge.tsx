import clsx from 'clsx';

const COLOR_MAP: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
  TERMINATED: 'bg-red-50 text-red-700 border-red-200',
  SUCCEEDED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUCCEEDED_WITH_ERRORS: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  RUNNING: 'bg-blue-50 text-blue-700 border-blue-200'
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', COLOR_MAP[status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
