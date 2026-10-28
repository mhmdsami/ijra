"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
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

export function SessionEmpty({ onStart }: { onStart?: () => void }) {
  const { query, setQuery } = useSessions();
  if (query) {
    return (
      <div className="px-2 py-6 text-center">
        <p className="text-xs text-text-secondary">No threads match “{query}”.</p>
        <button
          type="button"
          onClick={() => void setQuery("")}
          className="mt-2 text-2xs text-primary underline underline-offset-4"
        >
          Clear search
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <MessageSquarePlus className="size-5 text-text-tertiary" />
      <div>
        <p className="text-sm text-foreground">No threads yet</p>
        <p className="mt-1 text-xs leading-5 text-text-tertiary">
          Ask a question or file a change. Each thread keeps its context and pull requests.
        </p>
      </div>
      <Link
        href="/"
        onClick={onStart}
        className="rounded-md border px-2.5 py-1 text-2xs text-foreground transition-colors hover:bg-surface-2"
      >
        Start a request
      </Link>
    </div>
  );
}
