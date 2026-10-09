import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@prepzii/contracts", "@prepzii/assessment-core", "@prepzii/ui"],
};

export default nextConfig;

