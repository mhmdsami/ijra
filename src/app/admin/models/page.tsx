import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardAdmin } from "../actions";
import { listModels, modelUsage } from "@/db";
import { HeaderActions } from "../../header-actions";
import { AdminNav } from "@/components/admin-nav";
import { ModelCatalog, type CatalogItem } from "./model-catalog";

import { modelCatalog } from "@/lib/model-catalog";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  await guardAdmin();
  const [enabled, catalog, usage] = await Promise.all([listModels(), modelCatalog().catch(() => null), modelUsage()]);
  const listing = catalog ?? [];
  const enabledIds = new Set(enabled.map((m) => m.id));
  const defaultId = enabled.find((m) => m.is_default === 1)?.id ?? enabled[0]?.id ?? "";

  const enabledItems: CatalogItem[] = enabled
    .filter((m) => listing.some((c) => c.id === m.id))
    .map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1, isDefault: m.id === defaultId, enabled: true, unavailable: listing.find((c) => c.id === m.id)?.deprecated }));
  const missing: CatalogItem[] = enabled
    .filter((m) => !listing.some((c) => c.id === m.id))
    .map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1, isDefault: m.id === defaultId, enabled: true, stale: catalog !== null, unavailable: true }));
  const available: CatalogItem[] = listing
    .filter((m) => !enabledIds.has(m.id))
    .map((m) => ({ id: m.id, label: m.name, vision: m.vision, isDefault: false, enabled: false, unavailable: m.deprecated }));

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

        {catalog === null && (
          <p className="text-xs text-muted-foreground">Could not reach the model catalog. Try again shortly.</p>
        )}

        <ModelCatalog enabled={enabledItems} available={available} missing={missing} usage={usage} />
      </div>
    </div>
  );
}
