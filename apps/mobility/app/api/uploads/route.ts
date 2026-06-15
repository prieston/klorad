/**
 * `POST /api/uploads` — presigned PUT URL for direct-to-Spaces upload.
 *
 * Mirrors the campus pattern: the browser PUTs the file straight to
 * DigitalOcean Spaces using the returned signed URL, then registers
 * the resulting public URL against the relevant tenant resource
 * (device icons, world logos, …).
 *
 * The allowlist of `prefix` values is the single source of truth for
 * which surfaces accept uploads — adding a new prefix here is the
 * only place a new upload target needs to learn its bucket layout.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { presignUpload, storageConfigFromEnv } from "@klorad/storage/server";
import type { PresignUploadInput } from "@klorad/storage/types";

const ALLOWED_PREFIXES = new Set<string>([
  "mobility-device-icons",
]);

const ALLOWED_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PresignUploadInput;
  try {
    body = (await req.json()) as PresignUploadInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.fileName || !body.fileType) {
    return NextResponse.json(
      { error: "fileName and fileType are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(body.fileType.toLowerCase())) {
    return NextResponse.json(
      { error: `Unsupported fileType: ${body.fileType}` },
      { status: 415 },
    );
  }
  const prefix = body.prefix ?? "mobility-device-icons";
  if (!ALLOWED_PREFIXES.has(prefix)) {
    return NextResponse.json(
      { error: `Unsupported prefix: ${prefix}` },
      { status: 400 },
    );
  }

  try {
    const result = await presignUpload(storageConfigFromEnv(), {
      ...body,
      prefix,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sign upload" },
      { status: 500 },
    );
  }
}
