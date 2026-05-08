import { defineConfig } from 'tsup';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  async onSuccess() {
    const dest = 'dist/styles/tokens.css';
    await mkdir(dirname(dest), { recursive: true });
    await copyFile('src/styles/tokens.css', dest);

    const bundle = 'dist/index.mjs';
    const contents = await readFile(bundle, 'utf8');
    if (!contents.startsWith('"use client"')) {
      await writeFile(bundle, `"use client";\n${contents}`);
    }
  },
  format: ['esm'],
  dts: { entry: 'src/index.ts', resolve: true },
  sourcemap: true,
  treeshake: true,
  minify: true,
  target: 'es2020',
  platform: 'browser',
  bundle: true,
  skipNodeModulesBundle: true,
  external: [
    /^react$/,
    /^react-dom$/,
    /^react-toastify$/,
    /^@mui\/material$/,
    /^@mui\/icons-material$/,
    /^@emotion\/react$/,
    /^@emotion\/styled$/,
    /^@react-three\/fiber$/,
    /^@react-three\/drei$/,
    /^three$/,
    /^react-dropzone$/,
  ],
  tsconfig: './tsconfig.json',
  esbuildOptions(options) {
    options.logOverride = { 'this-is-undefined-in-esm': 'silent' };
    options.drop = ['console', 'debugger'];
  },
});
