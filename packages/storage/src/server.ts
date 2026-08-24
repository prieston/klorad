import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  AbortMultipartUploadInput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadResult,
  CreateMultipartUploadInput,
  CreateMultipartUploadResult,
  PresignUploadInput,
  PresignUploadPartInput,
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

function buildObjectKey(prefix: string | undefined, fileName: string): string {
  const folder = (prefix ?? "uploads").replace(/^\/|\/$/g, "");
  return `${folder}/${Date.now()}-${sanitizeFileName(fileName)}`;
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
    // AWS SDK v3 ≥ 3.729 defaults to `WHEN_SUPPORTED`, which bakes a
    // CRC32 of an *empty* body into every presigned PUT URL (the SDK
    // computes the checksum at sign time, but a presigned URL has no
    // body to checksum yet). DigitalOcean Spaces — and every other
    // S3-compatible service that isn't AWS S3 — then 403s when the
    // browser PUTs the real (non-empty) body because the signed
    // checksum doesn't match. Reverting to `WHEN_REQUIRED` skips
    // automatic checksums; we only get them when we ask for them.
    // See AWS SDK release notes around 3.729 and the GitHub issue
    // thread `aws-sdk-js-v3#6810`.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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
  const key = buildObjectKey(input.prefix, input.fileName);

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

/** S3-compatible storage requires every part except the last to be >= 5 MiB. */
export const MULTIPART_MIN_PART_SIZE = 5 * 1024 * 1024;

/** And permits at most 10,000 parts per upload. */
export const MULTIPART_MAX_PARTS = 10_000;

/** And at most 5 GiB in any single part. */
export const MULTIPART_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;

/**
 * Choose a part size for a known total.
 *
 * The floor is the 5 MiB minimum; above roughly 50 GB the 10,000-part ceiling
 * binds instead and the part size has to grow. Rounded up to a whole MiB so
 * the browser can slice on a clean boundary.
 *
 * A 26 GB point cloud — the size §6.3.4 of the Heritage spec uses as its
 * example — lands on 5 MiB parts, about 5,300 of them.
 */
export function recommendPartSize(totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error("totalBytes must be a positive number");
  }
  const mib = 1024 * 1024;
  const needed = Math.ceil(totalBytes / MULTIPART_MAX_PARTS);
  const size = Math.ceil(Math.max(MULTIPART_MIN_PART_SIZE, needed) / mib) * mib;
  if (size > MULTIPART_MAX_PART_SIZE) {
    throw new Error(
      `File too large for multipart upload: ${totalBytes} bytes would need ` +
        `parts above the ${MULTIPART_MAX_PART_SIZE}-byte limit`,
    );
  }
  return size;
}

/**
 * Begin a multipart upload. Server-side — it signs with the secret key and
 * returns an `uploadId` the browser carries through the rest of the flow.
 */
export async function createMultipartUpload(
  cfg: StorageConfig,
  input: CreateMultipartUploadInput,
): Promise<CreateMultipartUploadResult> {
  const acl: UploadAcl = input.acl ?? "public-read";
  const key = buildObjectKey(input.prefix, input.fileName);

  const client = makeClient(cfg);
  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: input.fileType,
      ACL: acl,
    }),
  );
  if (!result.UploadId) {
    throw new Error("Storage did not return an UploadId");
  }

  return {
    uploadId: result.UploadId,
    key,
    publicUrl: acl === "public-read" ? buildPublicUrl(cfg, key) : key,
    acl,
  };
}

/**
 * Presign a single part so the browser can PUT it directly.
 *
 * Called once per part. Deliberately not batched: parts retry individually,
 * an upload can be resumed hours later, and a long-lived batch of thousands of
 * URLs would expire together and be useless. Default lifetime is 6 hours,
 * longer than `presignUpload`'s hour, because a large upload legitimately
 * outlives a short window.
 *
 * No ACL or ContentType here — both were fixed by `createMultipartUpload`, and
 * signing them again on the part would change the signature the provider
 * expects.
 */
export async function presignUploadPart(
  cfg: StorageConfig,
  input: PresignUploadPartInput,
): Promise<string> {
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1) {
    throw new Error("partNumber must be a positive integer (1-based)");
  }
  if (input.partNumber > MULTIPART_MAX_PARTS) {
    throw new Error(`partNumber exceeds the ${MULTIPART_MAX_PARTS}-part limit`);
  }
  const client = makeClient(cfg);
  const command = new UploadPartCommand({
    Bucket: cfg.bucket,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });
  return getSignedUrl(client, command, {
    expiresIn: input.expiresIn ?? 6 * 3600,
  });
}

/**
 * Assemble the uploaded parts into one object.
 *
 * Parts are sorted by number before submission — the provider rejects an
 * out-of-order list, and the browser finishes parts in whatever order the
 * network allows.
 */
export async function completeMultipartUpload(
  cfg: StorageConfig,
  input: CompleteMultipartUploadInput,
): Promise<CompleteMultipartUploadResult> {
  if (input.parts.length === 0) {
    throw new Error("Cannot complete a multipart upload with no parts");
  }
  const client = makeClient(cfg);
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: [...input.parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })),
      },
    }),
  );
  return { key: input.key, publicUrl: buildPublicUrl(cfg, input.key) };
}

/**
 * Discard an incomplete upload and its parts.
 *
 * Worth calling on every abandoned upload: storage providers bill for orphaned
 * parts indefinitely, and a Heritage tenant abandoning a few 26 GB uploads is
 * a real cost, not a rounding error.
 */
export async function abortMultipartUpload(
  cfg: StorageConfig,
  input: AbortMultipartUploadInput,
): Promise<void> {
  const client = makeClient(cfg);
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: input.key,
      UploadId: input.uploadId,
    }),
  );
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
