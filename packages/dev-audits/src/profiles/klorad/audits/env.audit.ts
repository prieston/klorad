// packages/dev-audits/src/profiles/klorad/audits/env.audit.ts
/**
 * Environment Variables Audit
 * Based on: env.ts
 */

import path from "path";
import type {
  AuditDefinition,
  AuditContext,
  AuditResult,
} from "../../../core/types.js";

const REQUIRED_ENV_VARS = {
  NEXTAUTH_URL: {
    required: false, // Optional - NextAuth will auto-detect from request headers when trustHost: true
    pattern: /^https?:\/\//,
    description: "NextAuth base URL (optional - auto-detected when not set)",
  },
  DATABASE_URL: {
    required: true,
    pattern: /^(postgresql|prisma):\/\//,
    description: "PostgreSQL or Prisma Accelerate connection string",
  },
  // Note: NEXT_PUBLIC_CESIUM_ION_KEY is validated in apps/editor/lib/env/client.ts
  // and apps/editor/lib/env/server.ts, so we don't need to check it here
};

function maskSecret(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts
          .join("=")
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

export const envAudit: AuditDefinition = {
  id: "env",
  title: "Environment Variables",
  async run(ctx: AuditContext): Promise<AuditResult> {
    const items: AuditResult["items"] = [];

    // Check .env.production or .env.local (for local dev)
    const envFile = path.join(ctx.rootDir, "apps/editor/.env.production");
    const envLocalFile = path.join(ctx.rootDir, "apps/editor/.env.local");
    let env: Record<string, string> = {};
    let actualEnvFile: string | null = null;

    if (ctx.workspace.fileExists(envFile)) {
      const content = await ctx.workspace.readFile(envFile);
      env = parseEnvFile(content);
      actualEnvFile = envFile;
    } else if (ctx.workspace.fileExists(envLocalFile)) {
      // Fallback to .env.local for local development
      const content = await ctx.workspace.readFile(envLocalFile);
      env = parseEnvFile(content);
      actualEnvFile = envLocalFile;
    }

    // Merge with process.env (CI takes precedence)
    const finalEnv = { ...env, ...process.env };

    // In CI, require env vars. In local dev, allow missing if .env.local doesn't exist.
    // Vercel preview/development builds legitimately lack production secrets, don't
    // hard-fail those; GitHub CI and Vercel production deployments still enforce.
    const isVercelPreview =
      process.env.VERCEL_ENV === "preview" ||
      process.env.VERCEL_ENV === "development";
    const isCI =
      (!!process.env.CI || !!process.env.VERCEL) && !isVercelPreview;
    const hasEnvFile = actualEnvFile !== null;

    // why: SKIP_ENV_VALIDATION=1 is this repo's existing "fixture mode" signal, meaning
    // no database and no secrets in this run. apps/campus, apps/heritage and
    // apps/mobility all honour it in their own env.ts, and the heritage CI job and every
    // vertical build set it. Honour it here too: a GitHub Actions run has no database by
    // design, so demanding a DATABASE_URL from it only teaches people to paste a fake
    // one. Presence is relaxed; a value that IS set is still pattern-checked below, and
    // the Vercel production build (VERCEL set, SKIP_ENV_VALIDATION unset) still enforces.
    const isFixtureMode = process.env.SKIP_ENV_VALIDATION === "1";
    const requirePresence = (isCI || hasEnvFile) && !isFixtureMode;

    // Validate required vars
    for (const [key, schema] of Object.entries(REQUIRED_ENV_VARS)) {
      const value = finalEnv[key];

      // Only fail if in CI or if env file exists but var is missing, and this is
      // not a fixture-mode run
      if (schema.required && !value && requirePresence) {
        items.push({
          message: `Missing required env var: ${key} (${schema.description})`,
          file: actualEnvFile || envFile, // Use actual file read, fallback to production
          severity: "error",
          code: "MISSING_ENV_VAR",
        });
        continue;
      }

      if (value && schema.pattern && !schema.pattern.test(value)) {
        const masked = maskSecret(value);
        items.push({
          message: `Invalid ${key}: ${masked} (${schema.description})`,
          file: actualEnvFile || envFile, // Use actual file read
          severity: "error",
          code: "INVALID_ENV_VAR",
        });
      }
    }

    return {
      id: "env",
      title: "Environment Variables",
      ok: items.length === 0,
      items,
    };
  },
};
