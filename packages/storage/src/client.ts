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
    // ACL must be sent as a request header for DigitalOcean Spaces
    // to honour it. The signed URL also carries `?x-amz-acl=...` as
    // a query parameter, but in practice Spaces falls back to the
    // bucket-default ACL (private) when only the query string is
    // present and no matching header is sent — so without this line
    // every upload lands as a private object, even though the URL
    // was signed for `public-read`. DO Spaces is lenient about the
    // unsigned-header / signed-headers mismatch when the values
    // agree, so re-adding the header here doesn't break signature
    // verification.
    //
    // This briefly went away in #189 chasing a 403 that turned out
    // to be a Vercel-side secret mismatch (not an unsigned-header
    // rejection). With the secret fixed the request shape was fine;
    // removing this line just made the resulting objects private.
    if (opts.acl) xhr.setRequestHeader("x-amz-acl", opts.acl);
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
