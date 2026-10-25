"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";


export function ComposerControls({
  model,
  models,
  onModel,
  onSend,
  busy,
  disabled,
  className,
}: {
  model: string;
  models: { id: string; label: string }[];
  onModel: (m: string) => void;
  onSend: () => void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-0.5 rounded-lg border bg-surface-2/40 p-0.5", className)}>
      <select
        value={model}
        onChange={(e) => onModel(e.target.value)}
        className="w-36 min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-md bg-transparent py-1.5 pr-1 pl-2 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground sm:w-44 sm:flex-none"
        aria-label="Model"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id} className="bg-background text-foreground">
            {m.label}
          </option>
        ))}
      </select>
      <button
        onClick={onSend}
        disabled={disabled || busy}
        className="shrink-0 rounded-md p-1.5 text-foreground transition-[background-color,transform,opacity] hover:bg-surface-3 active:scale-95 disabled:opacity-40"
        aria-label="Send request"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
      </button>
    </span>
  );
}
