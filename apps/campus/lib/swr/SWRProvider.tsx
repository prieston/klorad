"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

/**
 * App-wide SWR defaults for the consumer surfaces.
 *
 * - `fetcher` is the canonical JSON GET so every hook can rely on
 *   `const { data } = useSWR("/api/...")` without re-stating it.
 * - `revalidateOnFocus` is on so a visitor switching tabs and
 *   coming back gets fresh data (news, events, etc.).
 * - `revalidateIfStale` is on so any cached data over the dedupe
 *   window triggers a background refetch.
 * - `dedupingInterval` is 5s — short enough that the visitor never
 *   sees stale data after a real change, long enough that
 *   navigation-driven refetches don't thrash.
 * - `keepPreviousData` makes navigating between filtered views feel
 *   instant: the previous response stays visible while the next one
 *   is fetched, instead of falling back to a skeleton.
 *
 * The SSR-rendered surfaces seed SWR with `fallbackData` on the
 * matching hook so the very first paint is real data, not a skeleton.
 * Subsequent visits from the same session pop straight out of cache.
 */
async function defaultFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: defaultFetcher,
        revalidateOnFocus: true,
        revalidateIfStale: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5_000,
        keepPreviousData: true,
        errorRetryInterval: 5_000,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
