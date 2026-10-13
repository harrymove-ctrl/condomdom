import type { NextConfig } from "next";

const config: NextConfig = {
  // sharp is a native module: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["sharp"],
};

export default config;
