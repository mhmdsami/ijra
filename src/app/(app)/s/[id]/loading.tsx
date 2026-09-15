export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="h-6 w-14 animate-pulse rounded bg-secondary" />
        <div className="h-6 w-28 animate-pulse rounded bg-secondary" />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10 sm:py-12">
        <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  );
}
