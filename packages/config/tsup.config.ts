import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "factory/index": "src/factory/index.ts",
    "panels/index": "src/panels/index.ts",
    "scene-controls/index": "src/scene-controls/index.ts",
    "top-bar/index": "src/top-bar/index.ts",
    "types/index": "src/types/index.ts",
    "utils/index": "src/utils/index.ts",
    "workbench/index": "src/workbench/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  dts: {
    entry: [
      "src/index.ts",
      "src/factory/index.ts",
      "src/panels/index.ts",
      "src/scene-controls/index.ts",
      "src/top-bar/index.ts",
      "src/types/index.ts",
      "src/utils/index.ts",
      "src/workbench/index.ts",
    ],
    resolve: true,
  },
  sourcemap: true,
  treeshake: true,
  minify: true,
  target: "es2020",
  platform: "browser",
  bundle: true,
  skipNodeModulesBundle: true,
  external: [/^react$/, /^@mui\/icons-material$/, /^@klorad\/ui$/],
  tsconfig: "./tsconfig.json",
  esbuildOptions(options) {
    options.logOverride = { "this-is-undefined-in-esm": "silent" };
    options.drop = ["console", "debugger"];
  },
});
