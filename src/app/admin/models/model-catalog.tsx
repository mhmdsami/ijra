"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ModelRow } from "./model-row";
import type { ModelUsage } from "@/db";

export type CatalogItem = { id: string; label: string; vision: boolean; isDefault: boolean; enabled: boolean; unavailable?: boolean; stale?: boolean };

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
          aria-label="Search models"
          className="h-8 w-full rounded-md border bg-card px-2.5 text-sm outline-none placeholder:text-text-tertiary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <Sections shown={shown} usage={usage} hasQuery={query !== ""} onClear={() => setQ("")} />
      </>
    );
  }
  return <Sections shown={shown} usage={usage} hasQuery={query !== ""} onClear={() => setQ("")} />;
}

function Sections({
  shown,
  usage,
  hasQuery,
  onClear,
}: {
  shown: { enabled: CatalogItem[]; available: CatalogItem[]; missing: CatalogItem[] };
  usage: Record<string, ModelUsage>;
  hasQuery: boolean;
  onClear: () => void;
}) {
  const empty = shown.enabled.length + shown.available.length + shown.missing.length === 0;
  if (hasQuery && empty) {
    return (
      <EmptyState
        variant="inline"
        title="No models match."
        action={
          <button onClick={onClear} className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
            Clear search
          </button>
        }
      />
    );
  }
  return (
    <>
      <h2 className="type-label mt-2 text-text-tertiary">Enabled</h2>
      {shown.enabled.length === 0 && shown.missing.length === 0 && !hasQuery && (
        <EmptyState variant="inline" title="No models enabled." description="Enable one from Available below." />
      )}
      {shown.enabled.map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} />)}
      {shown.missing.map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} stale={m.stale} />)}
      <h2 className="type-label mt-5 text-text-tertiary">Available</h2>
      {shown.available.filter((m) => !m.unavailable).map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} />)}
      {shown.available.some((m) => m.unavailable) && (
        <>
          <h2 className="type-label mt-5 text-text-tertiary">Unavailable</h2>
          {shown.available.filter((m) => m.unavailable).map((m) => <ModelRow key={m.id} model={m} usage={usage[m.id]} />)}
        </>
      )}
    </>
  );
}
