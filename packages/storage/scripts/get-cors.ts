/**
 * Print the current CORS rules on the configured DigitalOcean Space.
 *
 * Companion to `set-cors.ts` — when an upload is failing with
 * "No 'Access-Control-Allow-Origin' header is present", run this
 * first to see whether the rule is actually applied. Three common
 * outcomes:
 *
 *   - `No CORS configuration found.` — the rule was removed; run
 *     `pnpm spaces:set-cors` to re-apply.
 *   - Rules listed but the visitor's origin isn't in `AllowedOrigins`
 *     — add it via `KLORAD_CORS_ORIGINS` + re-run set-cors.
 *   - Rules listed and look correct — the issue is elsewhere
 *     (signed-headers mismatch, bucket policy, signing clock skew).
 *
 * Reads the same env vars as `set-cors.ts`:
 *
 *   DO_SPACES_REGION
 *   DO_SPACES_ENDPOINT
 *   DO_SPACES_BUCKET
 *   DO_SPACES_KEY
 *   DO_SPACES_SECRET
 *
 * Usage from repo root:
 *
 *   pnpm spaces:get-cors
 */

import { GetBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { storageConfigFromEnv } from "../src/server";

async function main() {
  const cfg = storageConfigFromEnv();
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  try {
    const result = await client.send(
      new GetBucketCorsCommand({ Bucket: cfg.bucket }),
    );
    const rules = result.CORSRules ?? [];
    if (rules.length === 0) {
      console.log(
        `ℹ️  s3://${cfg.bucket} has zero CORS rules — uploads from the browser will fail. Run \`pnpm spaces:set-cors\`.`,
      );
      return;
    }
    console.log(`✅ s3://${cfg.bucket} CORS rules (${rules.length}):\n`);
    rules.forEach((r, i) => {
      console.log(`  [${i}]`);
      console.log(`    AllowedOrigins: ${JSON.stringify(r.AllowedOrigins ?? [])}`);
      console.log(`    AllowedMethods: ${JSON.stringify(r.AllowedMethods ?? [])}`);
      console.log(`    AllowedHeaders: ${JSON.stringify(r.AllowedHeaders ?? [])}`);
      console.log(`    ExposeHeaders:  ${JSON.stringify(r.ExposeHeaders ?? [])}`);
      console.log(`    MaxAgeSeconds:  ${r.MaxAgeSeconds ?? "(unset)"}`);
      console.log("");
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/NoSuchCORSConfiguration|404/i.test(msg)) {
      console.log(
        `ℹ️  s3://${cfg.bucket} has no CORS configuration. Run \`pnpm spaces:set-cors\` to apply one.`,
      );
      return;
    }
    console.error(`❌ Failed to read CORS: ${msg}`);
    process.exit(1);
  }
}

main();
