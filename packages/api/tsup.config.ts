import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  dts: {
    entry: ["src/index.ts", "src/react/index.ts"],
    resolve: true,
  },
  sourcemap: true,
  treeshake: true,
  minify: true,
  target: "es2020",
  platform: "browser",
  bundle: true,
  skipNodeModulesBundle: true,
  external: [
    /^react$/,
    /^react-dom$/,
    /^three$/,
    /^zustand$/,
    /^uuid$/,
    /^@klorad\/core$/,
  ],
  tsconfig: "./tsconfig.json",
  esbuildOptions(options) {
    options.logOverride = { "this-is-undefined-in-esm": "silent" };
  },
});
