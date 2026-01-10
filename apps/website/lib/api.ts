/**
 * API client utilities for SWR
 */

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const organizationsFetcher = (url: string) =>
  fetcher<{ organizations: Array<{ id: string; name: string; slug: string }> }>(url)
    .then((res) => res.organizations);

export const organizationFetcher = (url: string) =>
  fetcher<{ organization: { id: string; name: string; slug: string }; projects: Array<{
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    publishedUrl: string;
    updatedAt: Date | string;
  }> }>(url);
