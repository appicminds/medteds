export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children ? <p className="max-w-sm text-sm text-muted">{children}</p> : null}
      {action}
    </div>
  );
}
