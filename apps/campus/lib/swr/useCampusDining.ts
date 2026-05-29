"use client";

import useSWR from "swr";
import type { DiningLocation } from "@/lib/dining-db";

interface Response {
  dining: DiningLocation[];
}

export function useCampusDining(
  token: string,
  fallbackData?: DiningLocation[],
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Response>(
    token ? `/api/campus/${token}/dining` : null,
    {
      fallbackData: fallbackData ? { dining: fallbackData } : undefined,
    },
  );
  return {
    dining: data?.dining ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
