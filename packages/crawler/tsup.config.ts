import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    limits: "src/limits.ts",
  },
  outDir: "dist",
  format: ["esm"],
  dts: { entry: ["src/index.ts", "src/limits.ts"], resolve: true },
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: "es2020",
  platform: "node",
  bundle: true,
  skipNodeModulesBundle: true,
  external: [/^@anthropic-ai\/sdk$/, /^@mendable\/firecrawl-js$/],
  tsconfig: "./tsconfig.json",
});
