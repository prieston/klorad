import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Application, ReflectionKind } from "typedoc";

const ENTRY_POINT = path.resolve(process.cwd(), "../../packages/api/src/index.ts");
const TSCONFIG = path.resolve(process.cwd(), "../../packages/api/tsconfig.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "content/docs/reference/index.mdx");

function summaryOf(node) {
  const parts = node.comment?.summary ?? [];
  return parts.map((part) => part.text).join("").replace(/\n+/g, " ").trim();
}

function rowFor(node) {
  const kind = ReflectionKind.singularString(node.kind);
  const summary = summaryOf(node) || "_undocumented_";
  const source = node.sources?.[0];
  const link = source?.url
    ? `[${source.fileName}:${source.line}](${source.url})`
    : (source?.fileName ?? "");
  return `| \`${node.name}\` | ${kind} | ${summary} | ${link} |`;
}

// why: typedoc walks the real exports of packages/api/src/index.ts, so this
// table is generated, never hand-maintained; fumadocs-typescript itself only
// renders one type at a time and needs fumadocs-core@^16 (Next 16), which
// conflicts with the ~15.7 pin this app builds against (see ADR-0002).
export async function generateReference() {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [ENTRY_POINT],
    tsconfig: TSCONFIG,
    skipErrorChecking: true,
    excludeExternals: true,
  });

  const project = await app.convert();
  if (!project) throw new Error("TypeDoc failed to convert packages/api/src/index.ts");

  const children = [...(project.children ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const rows = children.map(rowFor);

  const body = [
    "---",
    "title: API reference",
    "description: Generated from packages/api/src/index.ts, the public entry point of @klorad/api.",
    "---",
    "",
    "Generated at build time by TypeDoc. Nothing below this line is hand-written.",
    "",
    "| Export | Kind | Summary | Source |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, body);
  return { count: children.length, names: children.map((c) => c.name) };
}
