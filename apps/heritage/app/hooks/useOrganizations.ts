"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

export interface Organization {
  id: string;
  name: string;
  slug?: string;
}

interface OrgsResponse {
  organizations: Organization[];
}

interface OrgResponse {
  organization: Organization;
}

export function useOrganizations() {
  const { data, isLoading } = useSWR<OrgsResponse>("/api/orgs", fetcher);
  return {
    organizations: data?.organizations ?? [],
    loadingOrganizations: isLoading,
  };
}

export function useOrganization(orgId?: string) {
  const { data, isLoading } = useSWR<OrgResponse>(
    orgId ? `/api/orgs/${orgId}` : null,
    fetcher,
  );
  return {
    organization: data?.organization ?? null,
    loadingOrganization: isLoading,
  };
}
