import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * `POST /api/broadcasts/click` — service-worker beacon. Body:
 *   { id: string, token: string }
 *
 * Increments `Broadcast.opened` when the (id, token) pair matches.
 * Public on purpose — clicks land from every kind of network,
 * including locked-screen contexts where no page is open, so we
 * can't require a session cookie.
 *
 * The token is a per-broadcast secret generated when the row is
 * created; without it anyone could pad the counter by guessing
 * Broadcast ids. We don't return the row — the response is just a
 * 204, so a wrong token leaks nothing about existence either.
 *
 * Best-effort by design: double-fires from a quick double-tap are
 * fine, missing fires from older browsers are fine. The number is
 * a popularity signal, not an audit trail.
 */
export async function POST(req: Request) {
  let body: { id?: unknown; token?: unknown } = {};
  try {
    body = (await req.json()) as { id?: unknown; token?: unknown };
  } catch {
    // The service worker uses `sendBeacon` with a JSON Blob; older
    // browsers might bail. Fall through to the no-op response.
    return new NextResponse(null, { status: 204 });
  }
  const id = typeof body.id === "string" ? body.id : null;
  const token = typeof body.token === "string" ? body.token : null;
  if (!id || !token) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    // updateMany — silent miss when the (id, token) pair doesn't
    // match. We deliberately do NOT distinguish "wrong token" from
    // "no such row" in the response.
    await prisma.broadcast.updateMany({
      where: { id, clickToken: token },
      data: { opened: { increment: 1 } },
    });
  } catch (err) {
    console.error("[broadcasts/click]", err);
  }
  return new NextResponse(null, { status: 204 });
}
