import type { CatalogModel, ModelCatalogResponse } from "./types.ts";

export async function modelCatalog(): Promise<CatalogModel[]> {
  const res = await fetch("https://models.dev/api.json", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("Could not load the model catalog");
  const data = await res.json() as ModelCatalogResponse;
  const provider = data?.["opencode-go"]?.models;
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) throw new Error("Invalid model catalog");
  return Object.entries(provider).flatMap(([id, value]) => {
    if (!value || typeof value !== "object") return [];
    const m = value as Record<string, unknown>;
    const modalities = m.modalities as { input?: unknown } | undefined;
    return [{
      id,
      name: typeof m.name === "string" ? m.name : id,
      vision: Array.isArray(modalities?.input) && modalities.input.includes("image"),
      deprecated: m.status === "deprecated",
    }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function availableModel(id: string) {
  const model = (await modelCatalog()).find((m) => m.id === id);
  if (!model || model.deprecated) throw new Error("This model is no longer available");
  return model;
}
