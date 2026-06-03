import "server-only";
import { z } from "zod";

/**
 * Typed, validated environment for apps/campus.
 *
 * Runs once at module load. Route handlers and lib modules that need
 * an env var should import `serverEnv` instead of touching
 * `process.env` directly — a missing var then surfaces at boot
 * (visible in the deploy logs) instead of as a confusing 500 hours
 * later when someone hits the obscure path that uses it.
 *
 * Two-tier model:
 *   1. **Boot-blocking** (DATABASE_URL, SECRET) — the app cannot
 *      meaningfully serve traffic without these. Schema is strict.
 *   2. **Feature-gating** (DO_SPACES_*, SECRETS_KEY, VAPID_*, etc.) —
 *      missing values disable a feature, not the whole app. Schema
 *      is permissive (`.optional()`); the call sites that already
 *      enforce presence (storage server.ts, secrets.ts) still throw
 *      on demand, and `features` below exposes booleans so the
 *      health endpoint can tell us *what's lit*.
 *
 * `SKIP_ENV_VALIDATION=1` is honoured for breakglass / Vercel-build
 * cases where validation would otherwise block the build container.
 * Don't set it as a default — it negates the whole point.
 *
 * NEXT_PUBLIC_* vars are intentionally NOT validated here. Next.js
 * inlines them client-side at build time; importing them from a
 * `server-only` module muddles the two. `features` reads them via
 * raw `process.env` for the same reason.
 */
const serverSchema = z.object({
  // ─ Boot-blocking ──────────────────────────────────────────────
  DATABASE_URL: z.string().url().describe("Postgres connection string"),
  SECRET: z
    .string()
    .min(16)
    .describe("NextAuth session-token signing secret"),

  // ─ Feature-gating (optional; degrade gracefully) ──────────────
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
  ANTHROPIC_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // ─ Mode ───────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SKIP_ENV_VALIDATION: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/** True when boot-blocking validation was bypassed via SKIP. */
export let envValidationSkipped = false;

function parse(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    envValidationSkipped = true;
    // Stub the two required keys so the parse succeeds — runtime
    // call sites still hit the real `process.env` value (or the
    // existing throw paths) if they actually need it.
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
    // Dev: warn loud, keep going so a frontend-only workflow isn't
    // blocked by a half-configured local machine.
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

/**
 * Per-feature flags derived from env. Centralised so route handlers
 * don't each re-check the same combinations — and so the health
 * endpoint reports a single source of truth.
 */
export const features = {
  /** AI chat ("Klio") is wired in. */
  klio: Boolean(serverEnv.ANTHROPIC_API_KEY),
  /** Server-side push broadcast is configured. */
  push: Boolean(
    serverEnv.VAPID_PRIVATE_KEY &&
      serverEnv.VAPID_SUBJECT &&
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  ),
  /** Transactional email (invites, password resets) is wired in. */
  email: Boolean(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM),
  /** At least one OAuth sign-in provider is configured. */
  oauthSignIn: Boolean(
    (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) ||
      (serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET),
  ),
  /** Object storage (uploads, branding, thumbnails) is configured. */
  uploads: Boolean(
    serverEnv.DO_SPACES_REGION &&
      serverEnv.DO_SPACES_ENDPOINT &&
      serverEnv.DO_SPACES_BUCKET &&
      serverEnv.DO_SPACES_KEY &&
      serverEnv.DO_SPACES_SECRET,
  ),
  /** At-rest secret encryption (BYOK Anthropic keys, etc.) is configured. */
  byokSecrets: Boolean(serverEnv.SECRETS_KEY),
  /** Server-side error reporting is configured. */
  sentry: Boolean(serverEnv.SENTRY_DSN),
} as const;

export type FeatureFlags = typeof features;
