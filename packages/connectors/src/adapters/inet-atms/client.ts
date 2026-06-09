/**
 * Thin HTTP client for the Parsons iNET REST API. Basic auth, JSON
 * parsing, sensible timeouts. Server-side only; never imported by
 * client components (credentials are never sent to the browser).
 */
import type { InetAtmsConfig, InetSubsystem } from "./types.js";

/** Hard cap so a hung ATMS doesn't tie up a sync job forever. */
const REQUEST_TIMEOUT_MS = 15_000;

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
    const base = `${config.host}/atms/${subsystem}-rest/rest/${subsystem}${path}`;
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
