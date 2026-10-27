"use client";

import { useEffect, useState } from "react";
import { useSessions } from "@/components/sessions-context";
import { cn } from "@/lib/utils";

export function SessionSearch({ className }: { className?: string }) {
  const { query, setQuery } = useSessions();
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (draft === query) return;
    const timer = setTimeout(() => void setQuery(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, query, setQuery]);

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder="Search threads"
      aria-label="Search threads"
      className={cn(
        "h-8 w-full rounded-md border bg-surface-1 px-2 text-xs text-foreground outline-none placeholder:text-text-tertiary focus-visible:border-ring",
        className,
      )}
    />
  );
}

export function SessionLoadMore({ className }: { className?: string }) {
  const { hasMore, loadingMore, loadMore } = useSessions();
  if (!hasMore) return null;
  return (
    <button
      type="button"
      onClick={() => void loadMore()}
      disabled={loadingMore}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40",
        className,
      )}
    >
      {loadingMore ? "Loading…" : "Load more"}
    </button>
  );
}
