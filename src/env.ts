import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface Env {
  DB: D1Database;
  GITHUB_PAT: string;
  IJRA_RUNNER_KEY: string;
  IJRA_SESSION_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export function env(): Env {
  return getCloudflareContext().env as unknown as Env;
}

export function now() {
  return Date.now();
}
