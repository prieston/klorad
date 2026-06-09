import "server-only";
import { z } from "zod";

/**
 * Typed, validated environment for apps/mobility.
 *
 * Mirrors apps/campus/lib/env.ts: boot-blocking required vars,
 * permissive feature-gating optional vars, `features` object that
 * boolean-summarises what's lit. Mobility-specific entries:
 *
 *   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: the operator console runs on
 *     Mapbox GL; null disables the map and shows a friendly placeholder
 *     instead. Read raw client-side via process.env per the same NEXT_PUBLIC
 *     reasoning Campus uses.
 *
 * Adapter-specific env (Firecrawl, Sentry, etc.) is intentionally
 * absent — Mobility doesn't reach those subsystems in v1.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  SECRET: z.string().min(16),

  SECRETS_KEY: z.string().optional(),
  DO_SPACES_REGION: z.string().optional(),
  DO_SPACES_ENDPOINT: z.string().optional(),
  DO_SPACES_BUCKET: z.string().optional(),
  DO_SPACES_KEY: z.string().optional(),
  DO_SPACES_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SKIP_ENV_VALIDATION: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export let envValidationSkipped = false;

function parse(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    envValidationSkipped = true;
    return serverSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://skip@skip/skip",
      SECRET: process.env.SECRET ?? "skip-skip-skip-skip-skip-skip-skip-skip",
    });
  }
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const header = "Invalid or missing environment variables:";
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${header}\n${issues}`);
    }
    console.warn(`[env] ${header}\n${issues}`);
    envValidationSkipped = true;
    return serverSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://dev@dev/dev",
      SECRET:
        process.env.SECRET ?? "dev-dev-dev-dev-dev-dev-dev-dev-dev-dev",
    });
  }
  return result.data;
}

export const serverEnv = parse();

export const features = {
  byokSecrets: Boolean(serverEnv.SECRETS_KEY),
  uploads: Boolean(
    serverEnv.DO_SPACES_REGION &&
      serverEnv.DO_SPACES_ENDPOINT &&
      serverEnv.DO_SPACES_BUCKET &&
      serverEnv.DO_SPACES_KEY &&
      serverEnv.DO_SPACES_SECRET,
  ),
  oauthSignIn: Boolean(
    (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) ||
      (serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET),
  ),
  /** Mapbox client token — gates the operator console map. */
  map: Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN),
} as const;

export type FeatureFlags = typeof features;
