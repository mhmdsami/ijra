"use client";

import { useTransition } from "react";
import { addModelAction, removeModelAction, setDefaultModelAction } from "../actions";
import { cn } from "@/lib/utils";

function lastUsed(ts: number | null | undefined) {
  if (!ts) return "never used";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
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
  model: { id: string; label: string; vision: boolean; isDefault: boolean; enabled: boolean };
  usage?: { runs: number; users: number; last: number | null };
  stale?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (formData: FormData) => Promise<void>, fields: Record<string, string>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    startTransition(() => void action(form));
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2", pending && "opacity-50")}>
      <div className="min-w-0">
        <div className="truncate text-xs text-foreground">{model.label}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {model.id}
          {model.vision && " · images"}
          {model.isDefault && " · default"}
          {stale && " · not in catalog"}
          {" · "}
          {usage ? `${usage.runs} run${usage.runs === 1 ? "" : "s"} · ${usage.users} user${usage.users === 1 ? "" : "s"} · ${lastUsed(usage.last)}` : lastUsed(null)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {model.enabled ? (
          <>
            <button
              type="button"
              disabled={model.isDefault}
              onClick={() => run(setDefaultModelAction, { id: model.id })}
              className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              {model.isDefault ? "default" : "make default"}
            </button>
            <button
              type="button"
              onClick={() => run(removeModelAction, { id: model.id })}
              className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-destructive"
            >
              remove
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => run(addModelAction, { id: model.id, label: model.label, vision: model.vision ? "1" : "" })}
            className="rounded-full bg-foreground px-3 py-1 text-[10px] uppercase tracking-wide text-background"
          >
            enable
          </button>
        )}
      </div>
    </div>
  );
}
