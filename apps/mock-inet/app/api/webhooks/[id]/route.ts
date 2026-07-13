import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { deleteWebhook } from "@/lib/webhooks";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const { id } = await params;
  const removed = deleteWebhook(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
