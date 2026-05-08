/**
 * Mapbox Engine Boundaries Audit - mapbox-gl imports only under @klorad/engine-mapbox
 */

import path from "path";
import type {
  AuditDefinition,
  AuditContext,
  AuditResult,
} from "../../../core/types.js";

function findLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

export const mapboxEngineBoundariesAudit: AuditDefinition = {
  id: "mapbox-engine-boundaries",
  title: "Mapbox Engine Boundaries Enforcement",
  async run(ctx: AuditContext): Promise<AuditResult> {
    const items: AuditResult["items"] = [];
    const packages = await ctx.workspace.getPackages();

    let engineMapboxPath: string | null = null;
    for (const pkg of packages) {
      if (pkg.packageJson.name === "@klorad/engine-mapbox") {
        engineMapboxPath = pkg.path;
        break;
      }
    }

    if (!engineMapboxPath) {
      return {
        id: "mapbox-engine-boundaries",
        title: "Mapbox Engine Boundaries Enforcement",
        ok: false,
        items: [
          {
            message: "@klorad/engine-mapbox package not found in workspace",
            severity: "error",
            code: "ENGINE_MAPBOX_MISSING",
          },
        ],
      };
    }

    const normalizedEnginePath = path.normalize(engineMapboxPath);
    const allFiles = await ctx.workspace.findFiles("**/*.{ts,tsx}", {
      ignore: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/*.d.ts",
        "**/dev-audits/**",
      ],
    });

    const importPattern = /from\s+['"]mapbox-gl['"]/g;

    for (const file of allFiles) {
      const fullPath = path.isAbsolute(file)
        ? file
        : path.join(ctx.rootDir, file);
      const normalizedFilePath = path.normalize(fullPath);
      const isInEngineMapbox =
        normalizedFilePath.includes(normalizedEnginePath) ||
        normalizedFilePath.replace(/\\/g, "/").includes(
          normalizedEnginePath.replace(/\\/g, "/")
        );

      if (isInEngineMapbox) continue;

      const content = await ctx.workspace.readFile(fullPath);
      const seenMatches = new Set<string>();
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        const beforeMatch = content.substring(
          Math.max(0, match.index - 20),
          match.index
        );
        if (beforeMatch.includes("type ")) continue;

        const line = findLineNumber(content, match.index);
        const matchKey = `${fullPath}:${line}`;
        if (seenMatches.has(matchKey)) continue;
        seenMatches.add(matchKey);

        items.push({
          message:
            'mapbox-gl must be imported only from @klorad/engine-mapbox; found direct import from "mapbox-gl"',
          file: fullPath,
          line,
          severity: "error",
          code: "MAPBOX_IMPORT_OUTSIDE_ENGINE",
        });
      }
    }

    const hasError = items.some((i) => i.severity === "error");
    return {
      id: "mapbox-engine-boundaries",
      title: "Mapbox Engine Boundaries Enforcement",
      ok: !hasError,
      items,
    };
  },
};
