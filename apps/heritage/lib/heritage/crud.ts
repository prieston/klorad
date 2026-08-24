import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { localizedTextSchema } from "./i18n";

/**
 * Shared plumbing for the Heritage CRUD routes.
 *
 * Every entity below a venue is scoped the same way, validated the same way
 * and fails the same way, so the handlers themselves stay thin enough to read
 * in one screen. Nothing here is Heritage-specific in spirit — if a second
 * vertical needs the same shape it should be lifted to a shared package
 * rather than copied.
 */

/** A translatable field. Optional at the schema level so a curator can save a
 *  draft before translating it; §7.2.10 requires human approval per language
 *  before publication, which is a publish-time check, not a write-time one. */
export const localized = localizedTextSchema;

/** URL-safe, lowercase, no leading/trailing dashes. Mirrors `slugify` in the
 *  console so a hand-typed value cannot produce a URL the UI would not. */
export const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single dashes",
  );

/** `{ position, rotation, scale }` — validated loosely because scenes carry
 *  engine-shaped data and pinning the exact tuple here would make every
 *  renderer change a migration. */
export const transformSchema = z.record(z.string(), z.unknown());

export function badRequest(message: string, issues?: unknown): NextResponse {
  return NextResponse.json({ error: message, issues }, { status: 400 });
}

export function notFound(what = "Not found"): NextResponse {
  return NextResponse.json({ error: what }, { status: 404 });
}

/**
 * Parse and validate a JSON body. Returns either the parsed data or the
 * response to send — callers branch on `"error" in result`.
 */
export async function readJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: badRequest("Invalid body", parsed.error.issues) };
  }
  return { data: parsed.data };
}

/**
 * Turn Prisma's constraint errors into something a curator can act on.
 *
 * P2002 is the one that actually reaches users: two objects sharing a slug
 * inside a venue, or two venues sharing a public URL. The generic "Internal
 * error" that would otherwise surface tells them nothing about which field to
 * change.
 */
export function handlePrismaError(err: unknown): NextResponse {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "");
      return NextResponse.json(
        {
          error: fields.includes("slug")
            ? "That URL is already taken — pick another"
            : `Already exists (${fields})`,
        },
        { status: 409 },
      );
    }
    if (err.code === "P2025") return notFound();
    if (err.code === "P2003") {
      return badRequest("Referenced record does not exist");
    }
  }
  console.error("[heritage] unhandled prisma error", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

/**
 * Wrap a handler body so Prisma constraint failures become useful responses
 * instead of unhandled rejections.
 */
export async function guarded(
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await run();
  } catch (err) {
    return handlePrismaError(err);
  }
}

/**
 * `BigInt` does not survive `JSON.stringify`, and file sizes are the whole
 * reason `HeritageRepresentationFile.sizeBytes` is a BigInt — a 26 GB point
 * cloud overflows a 32-bit int. Serialise to a string at the boundary so the
 * client keeps full precision.
 */
export function serialiseBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as T;
}
