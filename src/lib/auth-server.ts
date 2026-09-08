import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/auth-schema";
import type { Env } from "../env";

export function auth() {
  const { env } = getCloudflareContext();
  const e = env as unknown as Env;
  const db = drizzle(e.DB, { schema });
  return betterAuth({
    baseURL: e.BETTER_AUTH_URL || "http://localhost:3000",
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    plugins: [admin()],
    socialProviders: e.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: e.GOOGLE_CLIENT_ID,
            clientSecret: e.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  });
}

export type Auth = ReturnType<typeof auth>;
