/**
 * POST /api/maps/[mapId]/crawler/jobs — start a crawl. Sync run inside
 * the Vercel function (maxDuration capped below); Phase 3 will move
 * the work onto Inngest so jobs can outlive a 5-minute budget.
 *
 * GET /api/maps/[mapId]/crawler/jobs — last 20 jobs for the campus
 * dashboard (history strip).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { serverEnv, features } from "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import {
  CRAWLER_DEMO_LIMITS,
  createFirecrawlClient,
  runCrawl,
} from "@klorad/crawler";
import { campusExtractorProfile } from "@/lib/crawler/profile";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ mapId: string }>;

/** Vercel hard limit for Hobby is 60s; Pro raises it to 300s. The
 *  sync runner takes ~3-6s per page × up to 5 pages, so 60s is
 *  enough for the demo cap but only just. Phase 3 (Inngest) is the
 *  durable fix. */
export const maxDuration = 60;

/** Normalize and validate the URLs the rector pasted. */
function parseUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      out.push(u.toString());
    } catch {
      // Drop garbage silently; the UI also pre-validates.
    }
  }
  return out.slice(0, CRAWLER_DEMO_LIMITS.maxUrlsPerJob);
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const jobs = await prisma.crawlJob.findMany({
    where: { projectId: mapId },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      instructions: true,
      urls: true,
      pagesFetched: true,
      itemsCreated: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!features.crawler) {
    return NextResponse.json(
      { error: "Crawler is not configured on this server." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const urls = parseUrls(body.urls);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "At least one valid http(s) URL is required." },
      { status: 400 },
    );
  }

  const instructionsRaw =
    typeof body.instructions === "string" ? body.instructions.trim() : "";
  const instructions = instructionsRaw.slice(
    0,
    CRAWLER_DEMO_LIMITS.maxInstructionsLength,
  );

  // Demo cap on the inbox — if pending items already pile up,
  // refuse new crawls until the rector triages.
  const pendingCount = await prisma.discoveredItem.count({
    where: { projectId: mapId, status: "pending" },
  });
  if (pendingCount >= CRAWLER_DEMO_LIMITS.maxPendingItems) {
    return NextResponse.json(
      {
        error: `Inbox is full (${pendingCount} pending). Approve or reject items before starting a new crawl.`,
        code: "INBOX_FULL",
      },
      { status: 429 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  // Persist the job row up-front so the dashboard can show it
  // as "running" mid-flight (and so a thrown error still leaves a
  // historical trace).
  const job = await prisma.crawlJob.create({
    data: {
      projectId: mapId,
      status: "running",
      instructions: instructions || null,
      urls: urls as unknown as Prisma.InputJsonValue,
      startedById: session.user.id as string,
    },
  });

  try {
    const firecrawl = createFirecrawlClient(
      serverEnv.FIRECRAWL_API_KEY ?? "",
    );
    const anthropic = new Anthropic({
      apiKey: serverEnv.ANTHROPIC_API_KEY ?? "",
    });
    const result = await runCrawl(
      { firecrawl, anthropic },
      { urls, instructions, profile: campusExtractorProfile },
    );

    if (result.totalItems > 0) {
      await prisma.discoveredItem.createMany({
        data: result.pages.flatMap((page) =>
          page.items.map((item) => ({
            projectId: mapId,
            jobId: job.id,
            sourceUrl: page.sourceUrl,
            contentType: item.type,
            extracted: item.payload as unknown as Prisma.InputJsonValue,
          })),
        ),
      });
    }

    await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        finishedAt: new Date(),
        pagesFetched: result.pages.length,
        itemsCreated: result.totalItems,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: "done",
      pagesFetched: result.pages.length,
      itemsCreated: result.totalItems,
      perPage: result.pages.map((p) => ({
        sourceUrl: p.sourceUrl,
        status: p.status,
        items: p.items.length,
        error: p.error,
      })),
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Crawl failed";
    await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      },
    });
    console.error("[crawler] job failed", err);
    return NextResponse.json(
      { error: errorMessage, jobId: job.id },
      { status: 500 },
    );
  }
}
