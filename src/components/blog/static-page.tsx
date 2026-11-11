export function StaticPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[728px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      {updated ? <p className="mt-2 text-sm text-muted">Last updated {updated}</p> : null}
      <div className="prose-story mt-10">{children}</div>
    </main>
  );
}
