import config from "../projects.json";

export const RUNNER_REPO = config.runnerRepo;

export interface ProjectConfig {
  repo: string;
  defaultModel: string;
  enabled?: boolean;
}

export function projects() {
  return Object.entries(config.projects as Record<string, ProjectConfig>)
    .filter(([, cfg]) => cfg.enabled !== false)
    .map(([id, cfg]) => ({ id, cfg }));
}

export const MODELS = ["deepseek-flash", "muse-spark-1.3-contributor", "deepseek-v4-flash"] as const;
export const MODEL_LABELS: Record<string, string> = {
  "deepseek-flash": "DeepSeek V4.1 Flash",
  "muse-spark-1.3-contributor": "Muse Spark 1.3 Contributor",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
};

export function projectConfig(id: string) {
  const cfg = (config.projects as Record<string, ProjectConfig>)[id];
  if (!cfg) throw new Error(`Unknown project: ${id}`);
  return cfg;
}
