/**
 * One-shot script to apply the CORS policy on a DigitalOcean Space
 * so browsers can PUT directly to it from the campus dashboard.
 *
 * The presigned-URL upload flow signs a PUT request server-side and
 * hands it to the browser, which then sends the PUT straight to
 * `<bucket>.<region>.digitaloceanspaces.com`. DO Spaces will only
 * include `Access-Control-Allow-Origin` on that response if the
 * bucket has a CORS rule matching the request's `Origin` — without
 * one, every upload fails with a CORS error in the console.
 *
 * Reads the same env vars `@klorad/storage` already needs:
 *   DO_SPACES_REGION
 *   DO_SPACES_ENDPOINT
 *   DO_SPACES_BUCKET
 *   DO_SPACES_KEY
 *   DO_SPACES_SECRET
 *
 * Origins are read from `KLORAD_CORS_ORIGINS` (comma-separated), or
 * default to the production + local dev hosts campus uses today.
 *
 * Usage from repo root, with the env vars exported or sourced from
 * `apps/campus/.env`:
 *
 *   pnpm spaces:set-cors
 *
 * or with explicit origins:
 *
 *   KLORAD_CORS_ORIGINS="https://campus.klorad.com,http://localhost:3003" \
 *     pnpm spaces:set-cors
 *
 * Idempotent — running it again replaces the existing CORS rules
 * with whatever is in this script.
 */

import {
  PutBucketCorsCommand,
  S3Client,
  type CORSRule,
} from "@aws-sdk/client-s3";
import { storageConfigFromEnv } from "../src/server";

const DEFAULT_ORIGINS = [
  "https://campus.klorad.com",
  "http://localhost:3003",
];

function parseOrigins(): string[] {
  const raw = process.env.KLORAD_CORS_ORIGINS;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const cfg = storageConfigFromEnv();
  const origins = parseOrigins();
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  // One rule is enough — Spaces supports up to 100, but we only
  // need PUT/GET/HEAD for the browser direct-upload flow. The
  // wildcard `AllowedHeaders` covers every `x-amz-*` header the
  // AWS SDK adds (checksums, ACL, signed-headers list).
  //
  // MaxAgeSeconds = 5 minutes. Was 3000 (50 min); reduced because
  // a longer preflight cache turned every CORS-related fix into
  // a guaranteed 50-minute "wait for the browser cache to expire"
  // saga. We hit this twice on 2026-06-02 chasing what looked
  // like a CORS regression but was actually a stale preflight
  // remembering a failure from an earlier broken state. 5 min is
  // long enough to deduplicate preflights inside a normal session
  // and short enough that fixes feel immediate.
  const rule: CORSRule = {
    AllowedOrigins: origins,
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 300,
  };

  await client.send(
    new PutBucketCorsCommand({
      Bucket: cfg.bucket,
      CORSConfiguration: { CORSRules: [rule] },
    }),
  );

  console.log(
    `✅ CORS applied to s3://${cfg.bucket} for origins: ${origins.join(", ")}`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ Failed to set CORS: ${message}`);
  process.exit(1);
});
