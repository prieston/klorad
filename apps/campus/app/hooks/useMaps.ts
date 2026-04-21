import useSWR from "swr";

export interface CampusMap {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMaps(orgId: string) {
  const { data, error, isLoading, mutate } = useSWR<CampusMap[]>(
    orgId ? `/api/maps?orgId=${orgId}` : null,
    fetcher
  );

  const createMap = async (name: string): Promise<CampusMap | null> => {
    const res = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name }),
    });
    if (!res.ok) return null;
    const map = (await res.json()) as CampusMap;
    await mutate();
    return map;
  };

  const deleteMap = async (mapId: string): Promise<void> => {
    await fetch(`/api/maps/${mapId}`, { method: "DELETE" });
    await mutate();
  };

  return {
    maps: data ?? [],
    isLoading,
    error,
    createMap,
    deleteMap,
    mutate,
  };
}
