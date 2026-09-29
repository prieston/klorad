import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateGettingStarted } from "./lib/getting-started.mjs";
import { generateReference } from "./lib/reference.mjs";

const LLMS_PATH = path.resolve(process.cwd(), "public/llms.txt");

function apiMap(names) {
  return names.map((name) => `- ${name}`).join("\n");
}

async function generateLlmsTxt(guide, reference) {
  const content = [
    "# Klorad docs, plain markdown for agents",
    "",
    guide.markdown,
    "",
    "## API map (packages/api/src/index.ts, generated)",
    "",
    apiMap(reference.names),
    "",
  ].join("\n");
  await mkdir(path.dirname(LLMS_PATH), { recursive: true });
  await writeFile(LLMS_PATH, content);
}

const guide = await generateGettingStarted();
const reference = await generateReference();
await generateLlmsTxt(guide, reference);

console.log(
  `[docs] getting started: ${guide.source}, reference: ${reference.count} exports, llms.txt written`,
);
