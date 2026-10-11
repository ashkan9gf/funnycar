import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_ANDROID === "1" ? "export" : "standalone",
  // Keep type errors fatal in CI and production builds.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
