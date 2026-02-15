import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "components/index": "src/components/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  dts: {
    entry: ["src/index.ts", "src/components/index.ts"],
    resolve: false,
  },
  sourcemap: true,
  treeshake: true,
  minify: true,
  target: "es2020",
  platform: "browser",
  bundle: true,
  skipNodeModulesBundle: true,
  external: [
    /^@klorad\/core$/,
    /^@klorad\/ion-sdk$/,
    /^@klorad\/ui$/,
    /^react$/,
    /^react-dom$/,
    /^cesium$/,
    /^@cesium\/engine$/,
    /^@mui\/material$/,
    /^@mui\/icons-material$/,
    /^@react-three\/fiber$/,
    /^@react-three\/drei$/,
    /^three$/,
  ],
  tsconfig: "./tsconfig.json",
  esbuildOptions(options) {
    options.logOverride = { "this-is-undefined-in-esm": "silent" };
    options.drop = ["console", "debugger"];
  },
});
