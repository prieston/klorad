/**
 * GET /api/oembed?url=…&format=json&maxwidth=…&maxheight=…
 *
 * The oEmbed provider endpoint (§7.4.2, HER-402).
 *
 * Unauthenticated by requirement, not by oversight: a consumer resolving an
 * embed is an anonymous server somewhere, and §7.4.2 makes "no authentication"
 * and "no tenant login wall on published objects" acceptance criteria. Only
 * published records in published venues resolve — a draft returns 404, which
 * is the correct answer and also stops an unpublished record leaking its title
 * through an embed lookup.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import {
  buildRichResponse,
  parseCanonicalUrl,
  type EmbedTarget,
} from "@/lib/heritage/oembed";

/** oEmbed consumers are third-party servers; the payload is public by design. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function resolveTarget(target: EmbedTarget) {
  if (target.kind === "object") {
    const object = await prisma.heritageObject.findFirst({
      where: {
        slug: target.slug,
        state: "published",
        venue: { slug: target.venueSlug, project: { isPublished: true } },
      },
      select: {
        title: true,
        venue: { select: { name: true, defaultLanguage: true } },
      },
    });
    if (!object) return null;
    const lang = object.venue.defaultLanguage;
    return {
      title: pickLocalized(object.title, lang, "en") ?? target.slug,
      authorName: pickLocalized(object.venue.name, lang, "en") ?? "Klorad Heritage",
    };
  }

  const scene = await prisma.heritageScene.findFirst({
    where: {
      slug: target.slug,
      state: "published",
      venue: { slug: target.venueSlug, project: { isPublished: true } },
    },
    select: {
      title: true,
      venue: { select: { name: true, defaultLanguage: true } },
    },
  });
  if (!scene) return null;
  const lang = scene.venue.defaultLanguage;
  return {
    title: pickLocalized(scene.title, lang, "en") ?? target.slug,
    authorName: pickLocalized(scene.venue.name, lang, "en") ?? "Klorad Heritage",
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestUrl = new URL(req.url);
  const params = requestUrl.searchParams;

  const url = params.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "The `url` parameter is required" },
      { status: 400, headers: CORS },
    );
  }

  // The spec allows json and xml and requires a provider to support at least
  // one. We support json; anything else is 501, which is the response oEmbed
  // names for an unsupported format rather than a generic 400.
  const format = params.get("format") ?? "json";
  if (format !== "json") {
    return NextResponse.json(
      { error: `Format "${format}" is not supported; use json` },
      { status: 501, headers: CORS },
    );
  }

  const target = parseCanonicalUrl(url);
  if (!target) {
    return NextResponse.json(
      { error: "That URL is not an embeddable Klorad Heritage resource" },
      { status: 404, headers: CORS },
    );
  }

  const resolved = await resolveTarget(target);
  if (!resolved) {
    return NextResponse.json(
      { error: "Not found, or not published" },
      { status: 404, headers: CORS },
    );
  }

  // Derive the origin from the request rather than an env var, so the payload
  // is correct behind a preview deployment, a custom domain, or localhost
  // without any of them needing to be configured.
  const origin = requestUrl.origin;

  return NextResponse.json(
    buildRichResponse({
      origin,
      target,
      title: resolved.title,
      authorName: resolved.authorName,
      maxWidth: params.get("maxwidth"),
      maxHeight: params.get("maxheight"),
    }),
    { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } },
  );
}
