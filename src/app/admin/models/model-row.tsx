"use client";

import { useTransition } from "react";
import { addModelAction, removeModelAction, setDefaultModelAction } from "../actions";
import { cn } from "@/lib/utils";

export function ModelRow({
  model,
  stale = false,
}: {
  model: { id: string; label: string; vision: boolean; isDefault: boolean; enabled: boolean };
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
