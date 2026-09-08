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

export const MODELS = ["omen-alpha", "glm-5.3-flash"] as const;
export const MODEL_LABELS: Record<string, string> = {
  "omen-alpha": "Omen Alpha",
  "glm-5.3-flash": "GLM 5.3 Flash",
};

export function projectConfig(id: string) {
  const cfg = (config.projects as Record<string, ProjectConfig>)[id];
  if (!cfg) throw new Error(`Unknown project: ${id}`);
  return cfg;
}
