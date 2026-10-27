"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { addModelAction, removeModelAction, setDefaultModelAction } from "../actions";

function lastUsed(ts: number | null | undefined, now: number) {
  if (!ts) return "never used";
  const mins = Math.max(0, Math.round((now - ts) / 60_000));
  if (mins < 60) return `used ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `used ${hours}h ago`;
  return `used ${Math.round(hours / 24)}d ago`;
}

export function ModelRow({
  model,
  usage,
  stale = false,
}: {
  model: { id: string; label: string; vision: boolean; isDefault: boolean; enabled: boolean; unavailable?: boolean };
  usage?: { runs: number; users: number; last: number | null };
  stale?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // rendered after hydration so the server and client markup agree
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  function run(action: (formData: FormData) => Promise<void>, fields: Record<string, string>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    setActionError(null);
    startTransition(() => {
      action(form).catch(() => setActionError("failed, try again"));
    });
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5",
        pending && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-foreground">{model.label}</div>
        <div className="truncate font-mono text-2xs text-text-tertiary">
          {model.id}
          {model.vision && " · images"}
          {model.isDefault && " · default"}
          {stale ? " · not in catalog" : model.unavailable && " · unavailable"}
          {" · "}
          {usage
            ? `${usage.runs} run${usage.runs === 1 ? "" : "s"} · ${usage.users} user${usage.users === 1 ? "" : "s"} · ${lastUsed(usage.last, now ?? 0)}`
            : lastUsed(null, now ?? 0)}
        </div>
        {actionError && (
          <p role="alert" className="mt-1 text-2xs text-destructive">
            {actionError}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {model.enabled ? (
          <>
            <button
              type="button"
              disabled={model.isDefault || model.unavailable || stale || pending}
              onClick={() => run(setDefaultModelAction, { id: model.id })}
              className="rounded-md border px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
            >
              {model.isDefault ? "default" : "make default"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(removeModelAction, { id: model.id })}
              className="rounded-md border px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive disabled:opacity-30"
            >
              remove
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={model.unavailable || stale || pending}
            onClick={() => run(addModelAction, { id: model.id })}
            className="rounded-md bg-primary px-2.5 py-1 text-2xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {model.unavailable || stale ? "unavailable" : "enable"}
          </button>
        )}
      </div>
    </div>
  );
}
