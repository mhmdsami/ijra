"use client";

import type { RunRow } from "@/db";

export function StatusLine({ runs, onCancel, stage }: { runs: RunRow[]; onCancel: () => void; stage?: string }) {
  const latest = runs.at(-1);
  if (!latest) return null;
  const base =
    latest.status === "dispatching" ? "Dispatching request" : latest.status === "running" ? "Agent is working" : null;
  const label = stage ? `${base}: ${stage}` : base;
  if (!label) return null;
  return (
    <div className="animate-fade-up flex min-w-0 items-center gap-2 text-xs text-primary">
      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 shrink-0 text-text-tertiary underline underline-offset-4 transition-colors hover:text-foreground"
      >
        cancel
      </button>
    </div>
  );
}
