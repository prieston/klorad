/**
 * Thin HTTP client for the Parsons iNET REST API. Basic auth, JSON
 * parsing, sensible timeouts. Server-side only; never imported by
 * client components (credentials are never sent to the browser).
 */
import type { InetAtmsConfig, InetSubsystem } from "./types.js";

/** Hard cap so a hung ATMS doesn't tie up a sync job forever. List
 *  endpoints can be slow on first warm-up (cold caches) — 30s is the
 *  pragmatic upper bound; the sync runner separately wraps every
 *  call in a 60s function-budget umbrella. */
const REQUEST_TIMEOUT_MS = 30_000;

export interface InetHttpClient {
  /** GET {host}/atms/{subsystem}-rest/rest/{subsystem}{path}, parsed as JSON. */
  getJson<T = unknown>(
    subsystem: InetSubsystem,
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<T>;
}

export function createInetHttpClient(config: InetAtmsConfig): InetHttpClient {
  const auth = `Basic ${Buffer.from(
    `${config.username}:${config.password}`,
  ).toString("base64")}`;

  function buildUrl(
    subsystem: InetSubsystem,
    path: string,
    searchParams?: URLSearchParams,
  ): string {
    // The Parsons servlet treats `/cctv` and `/cctv/` differently —
    // requests without the trailing slash 301 to the slash variant.
    // Append the slash on the list endpoint (empty `path`) so basic
    // auth doesn't get dropped through the redirect.
    const root = `${config.host}/atms/${subsystem}-rest/rest/${subsystem}`;
    const base = path ? `${root}${path}` : `${root}/`;
    return searchParams && searchParams.size > 0
      ? `${base}?${searchParams.toString()}`
      : base;
  }

  return {
    async getJson<T>(
      subsystem: InetSubsystem,
      path: string,
      searchParams?: URLSearchParams,
    ): Promise<T> {
      const url = buildUrl(subsystem, path, searchParams);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: auth,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(
            `iNET ${subsystem} GET ${path} → ${res.status} ${res.statusText}`,
          );
        }
        return (await res.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
