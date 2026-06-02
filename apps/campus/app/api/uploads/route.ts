import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { presignUpload, storageConfigFromEnv } from "@klorad/storage/server";
import type { PresignUploadInput } from "@klorad/storage/types";
import { UPLOAD_PREFIXES } from "@/lib/uploads/prefixes";

/**
 * Allowlist of upload prefixes the browser may target.
 *
 * Builds from `UPLOAD_PREFIXES` so the client and the server stay in
 * sync — the client *passes* a prefix, the server *validates* it,
 * both read the same constants. Adding a new surface = one entry
 * there, no follow-up edit here.
 *
 * Legacy prefixes (`campus-hero`, `campus-news`, etc.) are kept here
 * during a transition window so an admin tab opened *before* the
 * rector reloaded the dashboard doesn't get a 400 from a stale
 * client string. They can be removed in a follow-up once we know
 * nothing in the wild still sends them.
 */
const ALLOWED_PREFIXES = new Set<string>([
  ...Object.values(UPLOAD_PREFIXES),
  // Parked workbench floor-plan uploader.
  "floor-plans",
  // Legacy strings the old client shipped before the rename. Drop
  // once the dashboard has been reloaded in production.
  "campus-hero",
  "campus-thumbnails",
  "campus-branding",
  "campus-news",
]);
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

/**
 * Generate a presigned PUT URL so the browser can upload a floor plan,
 * thumbnail, or branding asset directly to DigitalOcean Spaces.
 */
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
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(body.fileType.toLowerCase())) {
    return NextResponse.json(
      { error: `Unsupported fileType: ${body.fileType}` },
      { status: 415 }
    );
  }

  const prefix = body.prefix ?? "floor-plans";
  if (!ALLOWED_PREFIXES.has(prefix)) {
    return NextResponse.json(
      { error: `Unsupported prefix: ${prefix}` },
      { status: 400 }
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
      { status: 500 }
    );
  }
}
