import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for minimal Docker images
  output: "standalone",
  // Optional sub-path mount (e.g. when serving behind a reverse proxy at `/knowledge`).
  // Leave NEXT_PUBLIC_BASE_PATH unset to serve at the root.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
