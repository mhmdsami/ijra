export interface RunUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  costUsd: number;
  modelCalls: number;
}

const empty: RunUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costUsd: 0, modelCalls: 0 };

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function parseUsage(value: unknown): RunUsage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...empty };
  const usage = value as Record<string, unknown>;
  const cost = usage.cost && typeof usage.cost === "object" ? (usage.cost as Record<string, unknown>) : null;
  return {
    input: count(usage.input),
    output: count(usage.output),
    cacheRead: count(usage.cacheRead),
    cacheWrite: count(usage.cacheWrite),
    totalTokens: count(usage.totalTokens),
    costUsd: count(usage.costUsd ?? cost?.total),
    modelCalls: Math.floor(count(usage.modelCalls)),
  };
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function formatCost(value: number) {
  if (!value) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
