import useSWR from "swr";
import type { CampusHealth } from "@/lib/campus-health";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<CampusHealth>;
  });

/**
 * SWR-backed read of the campus health snapshot — drives the
 * Campus Dashboard's checklist + the KPI cards. Reuses SWR's dedupe
 * so two screens mounting this hook in the same tab share one
 * round-trip.
 */
export function useCampusHealth(mapId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<CampusHealth>(
    mapId ? `/api/maps/${mapId}/health` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );
  return {
    health: data ?? null,
    error,
    isLoading,
    mutate,
  };
}
