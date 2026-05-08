import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  PresignUploadInput,
  PresignUploadResult,
  StorageConfig,
  UploadAcl,
} from "./types";

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildPublicUrl(cfg: StorageConfig, key: string): string {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  // Spaces pattern: https://<bucket>.<region>.digitaloceanspaces.com/<key>
  const endpointUrl = new URL(cfg.endpoint);
  return `${endpointUrl.protocol}//${cfg.bucket}.${endpointUrl.host}/${key}`;
}

function makeClient(cfg: StorageConfig): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

/**
 * Generate a presigned PUT URL the browser can upload to directly. Reuse
 * this from any Next.js route handler that needs to hand back upload
 * credentials — floor plans, thumbnails, model files, branding logos, …
 */
export async function presignUpload(
  cfg: StorageConfig,
  input: PresignUploadInput
): Promise<PresignUploadResult> {
  const acl: UploadAcl = input.acl ?? "public-read";
  const prefix = (input.prefix ?? "uploads").replace(/^\/|\/$/g, "");
  const safeName = sanitizeFileName(input.fileName);
  const key = `${prefix}/${Date.now()}-${safeName}`;

  const client = makeClient(cfg);
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: input.fileType,
    ACL: acl,
  });
  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresIn ?? 3600,
  });

  return {
    signedUrl,
    key,
    publicUrl: acl === "public-read" ? buildPublicUrl(cfg, key) : key,
    acl,
  };
}

/**
 * Read storage config from `process.env`. Throws if anything is missing.
 * Kept as a helper so route handlers don't all re-parse the same vars.
 */
export function storageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): StorageConfig {
  const required = [
    "DO_SPACES_REGION",
    "DO_SPACES_ENDPOINT",
    "DO_SPACES_BUCKET",
    "DO_SPACES_KEY",
    "DO_SPACES_SECRET",
  ] as const;
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing env var: ${key}`);
  }
  return {
    region: env.DO_SPACES_REGION as string,
    endpoint: env.DO_SPACES_ENDPOINT as string,
    bucket: env.DO_SPACES_BUCKET as string,
    accessKeyId: env.DO_SPACES_KEY as string,
    secretAccessKey: env.DO_SPACES_SECRET as string,
    publicBaseUrl: env.NEXT_PUBLIC_DO_SPACES_ENDPOINT,
  };
}
