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
    required: true,
    pattern: /^https?:\/\//,
    description: "NextAuth base URL",
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

    // In CI, require env vars. In local dev, allow missing if .env.local doesn't exist
    const isCI = !!process.env.CI || !!process.env.VERCEL;
    const hasEnvFile = actualEnvFile !== null;

    // Validate required vars
    for (const [key, schema] of Object.entries(REQUIRED_ENV_VARS)) {
      const value = finalEnv[key];

      // Only fail if in CI or if env file exists but var is missing
      if (schema.required && !value && (isCI || hasEnvFile)) {
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
