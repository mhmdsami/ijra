import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  void (async () => {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  })();
}
