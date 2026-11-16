import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run alongside the dev server without sharing .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Hostinger forces standalone output; NEXT_STANDALONE=1 reproduces that locally.
  ...(process.env.NEXT_STANDALONE ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["better-sqlite3", "rss-parser"],
};

export default nextConfig;
