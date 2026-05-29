"use client";

import useSWR from "swr";
import type { Club } from "@/lib/clubs-db";

interface Response {
  clubs: Club[];
}

export function useCampusClubs(token: string, fallbackData?: Club[]) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Response>(
    token ? `/api/campus/${token}/clubs` : null,
    {
      fallbackData: fallbackData ? { clubs: fallbackData } : undefined,
    },
  );
  return {
    clubs: data?.clubs ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
