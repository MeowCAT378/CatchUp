import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  allowedDevOrigins: ["10.5.0.2", "localhost", "127.0.0.1"],
};

export default nextConfig;
