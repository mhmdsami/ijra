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

export function projectConfig(id: string) {
  const cfg = (config.projects as Record<string, ProjectConfig>)[id];
  if (!cfg) throw new Error(`Unknown project: ${id}`);
  return cfg;
}
