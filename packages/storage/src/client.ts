"use client";

import type {
  PresignUploadInput,
  PresignUploadResult,
  UploadAcl,
} from "./types";

export interface RequestUploadUrlOptions {
  /** Route that wraps `presignUpload`. Defaults to `/api/uploads`. */
  endpoint?: string;
  /** Extra fetch options (e.g. `credentials: "include"` for cross-origin). */
  fetchOptions?: RequestInit;
}

/**
 * Ask the server for a presigned URL. Expects the server route to accept
 * JSON `{ fileName, fileType, prefix?, acl? }` and return `{ signedUrl,
 * key, publicUrl, acl }` — see `presignUpload` on the server side.
 */
export async function requestUploadUrl(
  input: PresignUploadInput,
  opts: RequestUploadUrlOptions = {}
): Promise<PresignUploadResult> {
  const res = await fetch(opts.endpoint ?? "/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    ...opts.fetchOptions,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return (await res.json()) as PresignUploadResult;
}

export interface UploadToSignedUrlOptions {
  contentType?: string;
  acl?: UploadAcl;
  onProgress?: (progress: number) => void;
}

/**
 * PUT a blob to a presigned URL with progress reporting. Works for any
 * S3-compatible target that signs `Content-Type` and optionally `x-amz-acl`.
 */
export function uploadToSignedUrl(
  signedUrl: string,
  file: File | Blob,
  opts: UploadToSignedUrlOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (opts.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) opts.onProgress!((e.loaded / e.total) * 100);
      });
    }
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed: network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      opts.contentType || file.type || "application/octet-stream"
    );
    // ACL is already baked into the presigned URL as a query parameter
    // (`x-amz-acl=...`) by the server. Sending it *also* as an HTTP
    // header here means the request carries an `x-amz-*` header that
    // *isn't* in the URL's `X-Amz-SignedHeaders=host` list — DO Spaces
    // (and other strict S3-compatibles) reject that combination with
    // 403, treating the unsigned header as signature tampering even
    // though the value matches the query string. AWS S3 itself is
    // lenient and accepts it; this is one of the spots S3-compatible
    // services diverge from S3. Don't send it.
    //
    // `opts.acl` is kept on the type for back-compat with any
    // hypothetical caller that builds its own request — the wrapped
    // `uploadFile` flow no longer needs it.
    xhr.send(file);
  });
}

/**
 * High-level one-shot: ask the server for a signed URL, PUT the file,
 * return the final public URL. Most callers want this.
 */
export async function uploadFile(
  file: File,
  input: Omit<PresignUploadInput, "fileName" | "fileType">,
  opts: RequestUploadUrlOptions & Pick<UploadToSignedUrlOptions, "onProgress"> = {}
): Promise<PresignUploadResult> {
  const signed = await requestUploadUrl(
    {
      ...input,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
    },
    { endpoint: opts.endpoint, fetchOptions: opts.fetchOptions }
  );
  await uploadToSignedUrl(signed.signedUrl, file, {
    contentType: file.type,
    acl: signed.acl,
    onProgress: opts.onProgress,
  });
  return signed;
}
