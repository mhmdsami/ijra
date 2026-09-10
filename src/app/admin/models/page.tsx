import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardAdmin } from "../actions";
import { listModels, modelUsage } from "@/db";
import { HeaderActions } from "../../header-actions";
import { AdminNav } from "@/components/admin-nav";
import { ModelCatalog, type CatalogItem } from "./model-catalog";

export const dynamic = "force-dynamic";

const CATALOG_URL = "https://models.dev/api.json";

type CatalogModel = { id: string; name: string; vision: boolean };

async function catalog(): Promise<CatalogModel[]> {
  try {
    const res = await fetch(CATALOG_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, { models: Record<string, { name?: string; modalities?: { input?: string[] } }> }>;
    const provider = data["opencode-go"]?.models ?? {};
    return Object.entries(provider)
      .map(([id, m]) => ({ id, name: m.name ?? id, vision: (m.modalities?.input ?? []).includes("image") }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export default async function ModelsPage() {
  await guardAdmin();
  const [enabled, listing, usage] = await Promise.all([listModels(), catalog(), modelUsage()]);
  const enabledIds = new Set(enabled.map((m) => m.id));
  const defaultId = enabled.find((m) => m.is_default === 1)?.id ?? enabled[0]?.id ?? "";

  const enabledItems: CatalogItem[] = enabled
    .filter((m) => listing.some((c) => c.id === m.id))
    .map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1, isDefault: m.id === defaultId, enabled: true }));
  const missing: CatalogItem[] = enabled
    .filter((m) => !listing.some((c) => c.id === m.id))
    .map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1, isDefault: m.id === defaultId, enabled: true, stale: true }));
  const available: CatalogItem[] = listing
    .filter((m) => !enabledIds.has(m.id))
    .map((m) => ({ id: m.id, label: m.name, vision: m.vision, isDefault: false, enabled: false }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-2xl italic tracking-[-0.07em] text-foreground" style={{ fontFamily: "var(--font-display)" }}>ijra</span>
        </Link>
        <div className="flex items-center gap-2">
          <AdminNav />
          <HeaderActions />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-1">
          <h1 className="text-lg text-foreground">Models</h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Enabled models show up in the composer. Sorting is by usage.
          </p>
        </div>

        {listing.length === 0 && enabled.length === 0 && (
          <p className="text-xs text-muted-foreground">Could not reach the model catalog. Try again shortly.</p>
        )}

        <ModelCatalog enabled={enabledItems} available={available} missing={missing} usage={usage} />
      </div>
    </div>
  );
}
