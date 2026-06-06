/**
 * Approval mappers — turn a `DiscoveredItem` row into a real
 * NewsPost / EventPost row when the rector clicks Approve.
 *
 * The extractor schema is permissive (title / body required,
 * everything else optional) so the mapping decides the defaults:
 *
 *  • News: `publishedAt` defaults to NOW when the page didn't carry
 *    a date — the rector can edit later from the news admin.
 *  • Events: a missing `startsAt` is fatal — an event without a date
 *    is just a note, so the API rejects the approval and tells the
 *    rector to edit before re-trying. (Phase 2 will add an inline
 *    edit form in the inbox.)
 */
import { prisma } from "@klorad/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CampusEventExtraction,
  CampusNewsExtraction,
} from "./profile";

export interface ApprovalContext {
  projectId: string;
  organizationId: string;
  /** Source URL the item was extracted from — written into the
   *  NewsPost body / EventPost description footer so the rector can
   *  trace any claim back to its origin in one click. */
  sourceUrl: string;
}

export async function approveAsNews(
  payload: CampusNewsExtraction,
  ctx: ApprovalContext,
): Promise<{ id: string }> {
  if (!payload.title?.trim() || !payload.body?.trim()) {
    throw new Error("Missing title or body");
  }
  const publishedAt = parseIsoDate(payload.publishedAt) ?? new Date();
  const sourceFooter = `— Source: ${ctx.sourceUrl}`;
  const created = await prisma.newsPost.create({
    data: {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      title: payload.title.slice(0, 200),
      titleEl: payload.titleEl?.trim() ? payload.titleEl.slice(0, 200) : null,
      body: `${payload.body}\n\n${sourceFooter}`,
      bodyEl: payload.bodyEl?.trim()
        ? `${payload.bodyEl}\n\n${sourceFooter}`
        : null,
      category: "news",
      publishedAt,
      imageUrl: payload.imageUrl ?? null,
      anchors: [] as unknown as Prisma.InputJsonValue,
    },
  });
  return { id: created.id };
}

export async function approveAsEvent(
  payload: CampusEventExtraction,
  ctx: ApprovalContext,
): Promise<{ id: string }> {
  if (!payload.title?.trim() || !payload.description?.trim()) {
    throw new Error("Missing title or description");
  }
  const startsAt = parseIsoDate(payload.startsAt);
  if (!startsAt) {
    throw new Error(
      "This event has no start date — open the source link, find the date, and add it manually for now (inline editing lands in Phase 2).",
    );
  }
  // Default an event to a 2-hour window when `endsAt` is missing —
  // a coarse value the rector can refine in the events admin.
  const endsAt =
    parseIsoDate(payload.endsAt) ??
    new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const description = composeEventDescription(
    payload.description,
    payload.location,
    ctx.sourceUrl,
  );
  const descriptionEl = payload.descriptionEl?.trim()
    ? composeEventDescription(
        payload.descriptionEl,
        payload.location,
        ctx.sourceUrl,
      )
    : null;
  const created = await prisma.eventPost.create({
    data: {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      title: payload.title.slice(0, 200),
      titleEl: payload.titleEl?.trim() ? payload.titleEl.slice(0, 200) : null,
      description,
      descriptionEl,
      startsAt,
      endsAt,
      registrationUrl: payload.registrationUrl ?? null,
      organizer: payload.organizer ?? null,
      imageUrl: payload.imageUrl ?? null,
      anchors: [] as unknown as Prisma.InputJsonValue,
      source: "crawler",
    },
  });
  return { id: created.id };
}

function composeEventDescription(
  body: string,
  location: string | undefined,
  sourceUrl: string,
): string {
  return [
    body,
    location ? `Location: ${location}` : "",
    "",
    `— Source: ${sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
