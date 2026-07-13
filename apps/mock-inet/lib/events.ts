/**
 * In-process event bus. Every SSE connection subscribes here; every
 * demo scenario / API mutation publishes here. Fan-out to registered
 * webhooks is also driven off this bus (see `webhooks.ts`).
 *
 * Vercel serverless quirk: each cold instance gets its own bus, which
 * would be a problem for a multi-tenant SaaS but is fine for a demo
 * because the scripted scenarios run in the same instance the SSE
 * client is connected to (Vercel routes idempotent GETs to the same
 * region + instance for the duration of the connection).
 */
import type { StreamEvent, StreamEventType } from "./types";
import { deliverEvent } from "./webhooks";

type Listener = (event: StreamEvent) => void;

const listeners: Set<Listener> = new Set();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publish(event: StreamEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[events] listener failed", err);
    }
  }
  // Fire-and-forget webhook delivery — don't block the caller.
  void deliverEvent(event);
}

/** Handy for the SSE route when the client passes `?events=` — it
 *  narrows the incoming type list down to valid `StreamEventType`s. */
export function parseEventFilter(raw: string | null): Set<StreamEventType> | null {
  if (!raw) return null;
  const wanted = new Set<StreamEventType>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (
      trimmed === "device.status_changed" ||
      trimmed === "incident.posted" ||
      trimmed === "incident.status_changed" ||
      trimmed === "vds.tick"
    ) {
      wanted.add(trimmed);
    }
  }
  return wanted.size > 0 ? wanted : null;
}
