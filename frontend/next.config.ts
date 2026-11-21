import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["unpdf"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  async redirects() {
    return [{ source: "/lecturer", destination: "/reports", permanent: false }];
  },
};

export default nextConfig;
