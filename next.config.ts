import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep type errors fatal in CI and production builds.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
