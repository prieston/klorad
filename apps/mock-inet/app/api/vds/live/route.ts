import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { snapshot } from "@/lib/vds";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  return NextResponse.json(snapshot());
}
