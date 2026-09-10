"use client";

import { useState } from "react";
import { ModelRow } from "./model-row";
import type { ModelUsage } from "@/db";

export type CatalogItem = { id: string; label: string; vision: boolean; isDefault: boolean; enabled: boolean; stale?: boolean };

export function ModelCatalog({
  enabled,
  available,
  missing,
  usage,
}: {
  enabled: CatalogItem[];
  available: CatalogItem[];
  missing: CatalogItem[];
  usage: Record<string, ModelUsage>;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const match = (m: CatalogItem) => !query || m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query);
  const rank = (m: CatalogItem) => usage[m.id]?.runs ?? 0;
  const byUse = (a: CatalogItem, b: CatalogItem) => rank(b) - rank(a) || a.label.localeCompare(b.label);

  const shown = {
    enabled: enabled.filter(match).sort(byUse),
    available: available.filter(match).sort(byUse),
    missing: missing.filter(match).sort(byUse),
  };

  if (enabled.length + available.length + missing.length > 8) {
    return (
      <>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search models"
          className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-primary/60"
        />
        <Sections shown={shown} usage={usage} hasQuery={query !== ""} />
      </>
    );
  }
  return <Sections shown={shown} usage={usage} hasQuery={query !== ""} />;
}

function Sections({
  shown,
  usage,
  hasQuery,
}: {
  shown: { enabled: CatalogItem[]; available: CatalogItem[]; missing: CatalogItem[] };
  usage: Record<string, ModelUsage>;
  hasQuery: boolean;
}) {
  const empty = shown.enabled.length + shown.available.length + shown.missing.length === 0;
  return (
    <>
      {hasQuery && empty && <p className="text-xs text-muted-foreground">No models match.</p>}
      <h2 className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Enabled</h2>
      {shown.enabled.map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} />)}
      {shown.missing.map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} stale />)}
      <h2 className="mt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Available</h2>
      {shown.available.map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} />)}
    </>
  );
}
