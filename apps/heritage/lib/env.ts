import "server-only";
import { z } from "zod";

/**
 * Typed, validated environment for apps/heritage.
 *
 * Same shape as apps/campus/lib/env.ts and apps/mobility/lib/env.ts:
 * boot-blocking required vars, permissive feature-gating optional vars, and a
 * `features` object that boolean-summarises what is lit.
 *
 * Heritage-specific note: `uploads` is not really optional past the scaffold
 * stage. Campus assumes a curator uploads a photograph; here a curator
 * uploads a 26 GB point cloud (§6.3.4), so object storage is load-bearing
 * rather than a nice-to-have. It stays gated only so the console can render a
 * legible "storage not configured" state instead of failing at the first
 * upload.
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

  /// Web Push (VAPID) — gates visitor notifications (§7.1.9). Set all three
  /// to light it up; missing any disables the feature without breaking the
  /// rest of the app.
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
      SECRET: process.env.SECRET ?? "dev-dev-dev-dev-dev-dev-dev-dev-dev-dev",
    });
  }
  return result.data;
}

export const serverEnv = parse();

export const features = {
  byokSecrets: Boolean(serverEnv.SECRETS_KEY),
  /** Object storage for ingest — see the note above. */
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
  /** VAPID configured — gates the visitor push opt-in + fanout (§7.1.9). */
  push: Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      serverEnv.VAPID_PRIVATE_KEY &&
      serverEnv.VAPID_SUBJECT,
  ),
} as const;

export type FeatureFlags = typeof features;
