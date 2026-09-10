import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the TypeScript compiler API. Next's CLI capture path returns empty
  // stdout under this Node 22 environment even though `tsc --showConfig` is valid.
  experimental: { useTypeScriptCli: false }
};

export default nextConfig;

