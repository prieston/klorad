import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const GUIDE_PATH = path.resolve(process.cwd(), "../../docs/guides/building-a-klorad-app.md");
const OUTPUT_PATH = path.resolve(process.cwd(), "content/docs/index.mdx");

// why: docs/guides/building-a-klorad-app.md is the one source of truth (PR
// #309); this reads it at build time instead of duplicating it, so the two
// never drift. Until #309 merges the file doesn't exist on this branch yet,
// so we fall back to an honest placeholder rather than copying its content.
const PLACEHOLDER = `---
title: Getting started
description: Build a Klorad app, from an empty project to a rendered, data-fed twin.
---

The getting started guide (\`docs/guides/building-a-klorad-app.md\`, PR #309) is not merged to
\`main\` yet. Once it lands, this page picks it up automatically on the next build, no further
change needed here.
`;

function toFrontmatter(markdown) {
  const firstLine = markdown.split("\n", 1)[0];
  const title = firstLine.startsWith("# ") ? firstLine.slice(2).trim() : "Getting started";
  const body = firstLine.startsWith("# ") ? markdown.slice(firstLine.length + 1) : markdown;
  const frontmatter = [
    "---",
    `title: ${title}`,
    "description: Build a Klorad app, from an empty project to a rendered, data-fed twin.",
    "---",
    "",
  ].join("\n");
  return frontmatter + body;
}

export async function generateGettingStarted() {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  let markdown;
  try {
    markdown = await readFile(GUIDE_PATH, "utf8");
  } catch {
    await writeFile(OUTPUT_PATH, PLACEHOLDER);
    return { source: "placeholder", markdown: PLACEHOLDER };
  }
  const withFrontmatter = toFrontmatter(markdown);
  await writeFile(OUTPUT_PATH, withFrontmatter);
  return { source: GUIDE_PATH, markdown: withFrontmatter };
}
