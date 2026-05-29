"use client";

import useSWR from "swr";
import type { EventPost } from "@/lib/events-db";

interface Response {
  events: EventPost[];
}

/**
 * Database event feed for a campus. ICS-sourced events stay
 * server-side — the SSR page merges them in before the client
 * mounts, and the client doesn't re-fetch the (potentially slow,
 * external) ICS feeds on revalidation.
 */
export function useCampusEvents(token: string, fallbackData?: EventPost[]) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Response>(
    token ? `/api/campus/${token}/events` : null,
    {
      fallbackData: fallbackData ? { events: fallbackData } : undefined,
    },
  );
  return {
    events: data?.events ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
