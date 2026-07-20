import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { listWebhooks, registerWebhook } from "@/lib/webhooks";
import { WebhookCreateSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  // Never leak the secret on list; it's shown only on create.
  const rows = await listWebhooks();
  const scrubbed = rows.map(({ secret: _secret, ...rest }) => rest);
  return NextResponse.json(scrubbed);
}

export async function POST(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = WebhookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const wh = await registerWebhook(parsed.data);
  return NextResponse.json(wh, { status: 201 });
}
