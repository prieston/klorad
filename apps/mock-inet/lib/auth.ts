/**
 * HTTP Basic auth for the mock. Reads `MOCK_USER` / `MOCK_PASS` from
 * env (defaults `demo` / `demo`). One helper covers every route.
 */
import { NextResponse } from "next/server";

const REALM = "PSMdt-iNET Mock";

function expected(): { user: string; pass: string } {
  return {
    user: process.env.MOCK_USER || "demo",
    pass: process.env.MOCK_PASS || "demo",
  };
}

/**
 * Returns `null` when the request passes auth. Returns a 401
 * `NextResponse` when it doesn't — the caller just short-circuits
 * with `if (denied) return denied`.
 */
export function requireBasicAuth(request: Request): NextResponse | null {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("basic ")) return unauthorized();
  const b64 = header.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  const want = expected();
  if (user === want.user && pass === want.pass) return null;
  return unauthorized();
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Basic realm="${REALM}"`,
      },
    },
  );
}
