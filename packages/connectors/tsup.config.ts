import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  dts: { entry: ["src/index.ts"], resolve: true },
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: "es2020",
  platform: "node",
  bundle: true,
  skipNodeModulesBundle: true,
  external: [/^zod$/],
  tsconfig: "./tsconfig.json",
});
