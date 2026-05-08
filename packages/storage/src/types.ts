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
