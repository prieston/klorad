import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// why: one collection for the whole site; Concepts and the generated
// reference are subfolders of content/docs, not separate collections.
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
