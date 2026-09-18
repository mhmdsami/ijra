import { getCloudflareContext } from "@opennextjs/cloudflare";

export function isLocalPreview() {
  try {
    const env = getCloudflareContext().env as Record<string, string | undefined>;
    if (env.LOCAL_PREVIEW !== "1") return false;
    return !!env.BETTER_AUTH_URL?.startsWith("http://localhost");
  } catch {
    return false;
  }
}
