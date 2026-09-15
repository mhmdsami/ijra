export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="h-6 w-14 animate-pulse rounded bg-secondary" />
        <div className="h-6 w-20 animate-pulse rounded bg-secondary" />
      </div>
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-8">
          <div className="h-7 w-40 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-4 w-72 max-w-full animate-pulse rounded bg-secondary" />
          <div className="mt-8 h-32 animate-pulse rounded-xl border bg-card" />
        </div>
      </section>
    </div>
  );
}
