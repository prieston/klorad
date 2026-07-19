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

/**
 * Detect a request that came from the mock's own homepage / demo
 * panel — one where the browser sends `Sec-Fetch-Site: same-origin`
 * (fetch from a page on the same host). Used to skip Basic auth on
 * `/api/demo/*` endpoints so the built-in demo control panel works
 * without a login prompt, while external CLIs / demo runners still
 * need `demo:demo` credentials.
 *
 * `Sec-Fetch-Site` is set by modern browsers on every `fetch`; it
 * can't be spoofed by a page on another origin because browsers
 * refuse to let scripts override it. Falls back to referer check
 * for older browsers.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  // Sec-Fetch-Site missing (older browser or direct navigation) —
  // fall back to a referer check against this deploy's host.
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    const refererHost = new URL(referer).host;
    const selfHost = request.headers.get("host") ?? "";
    return refererHost === selfHost && selfHost.length > 0;
  } catch {
    return false;
  }
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
