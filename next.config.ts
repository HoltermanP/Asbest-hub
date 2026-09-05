import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@react-pdf/renderer", "unpdf", "mammoth", "exceljs", "docx", "postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  // Prompt files are read from disk at runtime; make sure they ship with the serverless bundle.
  outputFileTracingIncludes: { "/**": ["./src/ai/prompts/**"] },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
