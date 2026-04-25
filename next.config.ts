import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep module resolution anchored to the project root.
    root: process.cwd(),
  },
};

export default nextConfig;
