export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-10 text-slate-500">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {description && <div className="text-xs mt-1 max-w-md mx-auto">{description}</div>}
    </div>
  );
}
