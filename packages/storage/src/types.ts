/**
 * Access-control hint for the uploaded object. Spaces honours `public-read`
 * so the public-viewer can hotlink the URL without further auth.
 */
export type UploadAcl = "public-read" | "private";

export interface PresignUploadInput {
  /** Original filename (used to build the key). */
  fileName: string;
  /** MIME type — required so the signed URL locks the Content-Type header. */
  fileType: string;
  /** Folder prefix inside the bucket. Defaults to "uploads". */
  prefix?: string;
  /** Defaults to "public-read" so consumers don't have to think about it. */
  acl?: UploadAcl;
  /** Signed URL lifetime in seconds. Defaults to 1 hour. */
  expiresIn?: number;
}

export interface PresignUploadResult {
  /** PUT here from the browser with the file bytes. */
  signedUrl: string;
  /** Path inside the bucket (no leading slash). Store this in your DB. */
  key: string;
  /** Final public URL (if `acl === "public-read"`), otherwise the key. */
  publicUrl: string;
  acl: UploadAcl;
}

/**
 * Minimum set of credentials needed to talk to an S3-compatible endpoint
 * (AWS S3, DigitalOcean Spaces, Cloudflare R2, MinIO, …).
 */
export interface StorageConfig {
  region: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Optional public URL prefix — used to build `publicUrl` for clients.
   * Falls back to `${endpoint}/${bucket}` if not set. For Spaces with a
   * custom CDN, set this to `https://cdn.example.com`.
   */
  publicBaseUrl?: string;
}

/**
 * Multipart upload.
 *
 * A single presigned PUT caps out at 5 GB on S3-compatible storage and, more
 * importantly, restarts from zero when the connection drops. Klorad Heritage
 * ingests point clouds and splat masters measured in tens of gigabytes over
 * whatever connection a documentation department has, so the upload has to be
 * resumable. Multipart gives both: parts upload independently, a failed part
 * retries on its own, and the browser can resume a session it already started.
 *
 * The create/complete/abort calls are server-side — they need the secret key.
 * Only the per-part PUTs are presigned and handed to the browser.
 */
export interface CreateMultipartUploadInput {
  fileName: string;
  fileType: string;
  prefix?: string;
  acl?: UploadAcl;
}

export interface CreateMultipartUploadResult {
  /** Opaque id from the storage provider; needed by every later call. */
  uploadId: string;
  key: string;
  /** Final URL once completed. Not fetchable until then. */
  publicUrl: string;
  acl: UploadAcl;
}

export interface PresignUploadPartInput {
  key: string;
  uploadId: string;
  /** 1-based, per the S3 API. Parts may be uploaded out of order. */
  partNumber: number;
  expiresIn?: number;
}

export interface CompletedPart {
  partNumber: number;
  /**
   * The `ETag` response header from that part's PUT. The browser can only
   * read it if the bucket's CORS policy exposes `ETag` — see
   * `scripts/set-cors.ts`, which does.
   */
  eTag: string;
}

export interface CompleteMultipartUploadInput {
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}

export interface CompleteMultipartUploadResult {
  key: string;
  publicUrl: string;
}

export interface AbortMultipartUploadInput {
  key: string;
  uploadId: string;
}

/** A byte range to read out of a stored object. `end` is inclusive, matching
 *  HTTP Range rather than JavaScript slice semantics. */
export interface ObjectRangeInput {
  key: string;
  start: number;
  end: number;
}

export interface ObjectRangeResult {
  body: Uint8Array;
  /** Bytes actually returned — may be shorter than requested at end-of-file. */
  contentLength: number;
  /** Full size of the object, parsed from `Content-Range`. Null if the
   *  provider omitted the header. */
  totalLength: number | null;
}
