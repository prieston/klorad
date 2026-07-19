/**
 * Server-Sent Events stream. `Content-Type: text/event-stream`, one
 * `StreamEvent` per message, keepalive comment every 15s so proxies
 * don't tear the connection down.
 *
 * Vercel caps a single SSE connection at ~300s on Pro (~30s on
 * Hobby). Client should reconnect with EventSource's built-in retry.
 */
import { NextRequest } from "next/server";
import { isSameOriginRequest, requireBasicAuth } from "@/lib/auth";
import { subscribe, parseEventFilter } from "@/lib/events";
import type { StreamEventType } from "@/lib/types";

export const runtime = "nodejs";
// Long-lived connection — bump the per-request timeout.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Same-origin bypass so the mock's own demo panel can subscribe
  // to the live event feed without a browser Basic-auth prompt.
  // External CLI subscribers (curl, dashboards, wireshark scripts)
  // still hit the credential check.
  if (!isSameOriginRequest(request)) {
    const denied = requireBasicAuth(request);
    if (denied) return denied;
  }

  const url = new URL(request.url);
  const filter = parseEventFilter(url.searchParams.get("events"));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      // Initial hello so the client sees traffic immediately.
      send(`retry: 5000\n\n`);
      send(`: connected ${new Date().toISOString()}\n\n`);

      const unsub = subscribe((event) => {
        if (filter && !filter.has(event.type as StreamEventType)) return;
        send(`event: ${event.type}\n`);
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      const keepalive = setInterval(() => {
        try {
          send(`: keepalive ${Date.now()}\n\n`);
        } catch {
          // Controller closed — cleanup below fires.
        }
      }, 15_000);

      const abort = () => {
        clearInterval(keepalive);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
