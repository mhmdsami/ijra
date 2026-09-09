"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MODELS, MODEL_LABELS } from "@/lib/projects";

export function ComposerControls({
  model,
  onModel,
  onSend,
  busy,
  disabled,
  quotaKey = 0,
}: {
  model: string;
  onModel: (m: string) => void;
  onSend: () => void;
  busy?: boolean;
  disabled?: boolean;
  quotaKey?: number;
}) {
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    let live = true;
    setQuota(null);
    fetch(`/api/quota?model=${encodeURIComponent(model)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => { if (live && q) setQuota(q as { used: number; limit: number }); })
      .catch(() => {});
    return () => { live = false; };
  }, [model, quotaKey]);

  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-foreground/25 bg-card p-0.5">
      <select
        value={model}
        onChange={(e) => onModel(e.target.value)}
        className="cursor-pointer appearance-none rounded-full py-1.5 pl-3 pr-1 text-[10px] tracking-wide text-foreground/60 outline-none hover:text-foreground"
        aria-label="Model"
      >
        {MODELS.map((m) => (
          <option key={m} value={m} className="bg-background text-foreground">
            {MODEL_LABELS[m] ?? m}
          </option>
        ))}
      </select>
      {quota?.limit != null && <span className="pr-0.5 text-[10px] text-muted-foreground">{quota.used}/{quota.limit}</span>}
      <button
        onClick={onSend}
        disabled={disabled || busy}
        className="mr-0.5 rounded-full p-1.5 text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
        aria-label="Send request"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
      </button>
    </span>
  );
}
