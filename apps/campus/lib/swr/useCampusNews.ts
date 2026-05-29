"use client";

import useSWR from "swr";
import type { NewsPost } from "@/lib/news";

interface Response {
  news: NewsPost[];
}

/**
 * Public news feed for a campus, fetched via `/api/campus/[token]/news`
 * and managed by SWR.
 *
 * The server page seeds the cache via `fallbackData`, so the first
 * paint never shows a skeleton — only subsequent navigations that
 * re-mount the client tree do. Background revalidation runs on
 * focus / reconnect / cache miss so the visitor always reads the
 * freshest data without a visible reload.
 */
export function useCampusNews(
  token: string,
  fallbackData?: NewsPost[],
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Response>(
    token ? `/api/campus/${token}/news` : null,
    {
      fallbackData: fallbackData ? { news: fallbackData } : undefined,
    },
  );
  return {
    news: data?.news ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
