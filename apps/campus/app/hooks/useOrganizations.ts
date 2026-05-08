import useSWRImmutable from "swr/immutable";

export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  isPersonal?: boolean;
  userRole?: string;
}

const listFetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => (d?.organizations ?? []) as Organization[]);

const oneFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => (d?.organization ?? null) as Organization | null);

export function useOrganizations() {
  const { data, error, isLoading, mutate } = useSWRImmutable<Organization[]>(
    "/api/organizations/list",
    listFetcher
  );
  return {
    organizations: data ?? [],
    loadingOrganizations: isLoading,
    error,
    mutate,
  };
}

export function useOrganization(orgId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWRImmutable<Organization | null>(
    orgId ? `/api/organizations/${orgId}` : null,
    oneFetcher
  );
  return {
    organization: data ?? null,
    loadingOrganization: isLoading,
    error,
    mutate,
  };
}
