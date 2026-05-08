import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { presignUpload, storageConfigFromEnv } from "@klorad/storage/server";
import type { PresignUploadInput } from "@klorad/storage/types";

const ALLOWED_PREFIXES = new Set([
  "floor-plans",
  "campus-thumbnails",
  "campus-branding",
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
