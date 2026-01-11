/**
 * Centralized API Client
 *
 * All API requests should go through this file.
 * Use SWR hooks for data fetching in components.
 */

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | null | undefined>;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Default options
  const defaultOptions: RequestInit = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...fetchOptions,
    headers: {
      ...defaultOptions.headers,
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    let errorData: unknown;
    // Clone the response before reading to avoid "body stream already read" error
    const clonedForJson = response.clone();
    try {
      // Try to parse as JSON from the cloned response
      errorData = await clonedForJson.json();
    } catch {
      // If JSON parsing fails, clone again and try reading as text
      try {
        const clonedForText = response.clone();
        errorData = await clonedForText.text();
      } catch {
        // If both fail, use status text
        errorData = response.statusText;
      }
    }
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

// ============================================================================
// User API
// ============================================================================

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
    userRole: string | null;
  } | null;
  accounts: Array<{
    provider: string;
    type: string;
  }>;
}

export async function getUser(): Promise<{ user: User }> {
  return apiRequest<{ user: User }>("/api/user");
}

// ============================================================================
// Organizations API
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  userRole: string | null;
  planCode?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

export interface Plan {
  code: string;
  name: string;
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  includedStorageGb: number;
  includedBandwidthGbPerMonth: number;
  includedSeats: number;
  includedProcessingJobsPerMonth: number;
  includedProjects: number | null;
  includedPublishedProjects: number | null;
  includedPrivateShares: number | null;
  includedCesiumIntegrations: number | null;
  cesiumUploadLimitGb: number | null;
  overageStoragePricePerGbCents: number;
  overageBandwidthPricePerGbCents: number;
  overageSeatPricePerMonthCents: number;
  stripeProductId: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
}

export async function getOrganization(orgId: string): Promise<{
  organization: Organization;
}> {
  if (!orgId) {
    throw new Error("organizationId is required");
  }
  return apiRequest<{ organization: Organization }>(
    `/api/organizations/${orgId}`
  );
}

export async function updateOrganization(
  data: {
    name?: string;
    slug?: string;
  },
  orgId: string
): Promise<{ organization: Organization }> {
  if (!orgId) {
    throw new Error("organizationId is required");
  }
  return apiRequest<{ organization: Organization }>(
    `/api/organizations/${orgId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function getAllOrganizations(): Promise<{
  organizations: Organization[];
}> {
  return apiRequest<{ organizations: Organization[] }>(
    "/api/organizations/list"
  );
}

export async function deleteOrganization(
  orgId: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/organizations/${orgId}`,
    {
      method: "DELETE",
    }
  );
}

export interface UsageStats {
  usage: {
    members: number;
    projects: number;
    publishedProjects: number;
    privateShares: number;
    cesiumIntegrations: number;
    storageGb: number;
    cesiumUploadGib: number; // GiB (binary) to match Cesium's display
  };
  limits: {
    members: number;
    projects: number | null;
    publishedProjects: number | null;
    privateShares: number | null;
    cesiumIntegrations: number | null;
    storageGb: number;
    cesiumUploadGib: number | null; // Stored as GB in DB, but displayed as GiB
  };
  plan: {
    code: string;
    name: string;
  };
}

export async function getUsageStats(orgId: string): Promise<UsageStats> {
  if (!orgId) {
    throw new Error("organizationId is required");
  }
  return apiRequest<UsageStats>(`/api/organizations/${orgId}/usage`);
}

// ============================================================================
// Cesium Ion Integrations API
// ============================================================================

export interface CesiumIonIntegration {
  id: string;
  organizationId: string;
  label: string;
  readTokenLast4: string;
  uploadTokenLast4: string;
  readTokenValid: boolean;
  uploadTokenValid: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  totalCesiumAssets: number;
  totalLocalAssets: number;
}

export async function getCesiumIntegrations(
  orgId: string
): Promise<{ integrations: CesiumIonIntegration[] }> {
  if (!orgId) {
    throw new Error("organizationId is required");
  }
  return apiRequest<{ integrations: CesiumIonIntegration[] }>(
    `/api/organizations/${orgId}/cesium-integrations`
  );
}

export async function createCesiumIntegration(
  orgId: string,
  data: {
    label: string;
    readToken: string;
    uploadToken: string;
  }
): Promise<{ integration: CesiumIonIntegration }> {
  if (!orgId) {
    throw new Error("organizationId is required");
  }
  return apiRequest<{ integration: CesiumIonIntegration }>(
    `/api/organizations/${orgId}/cesium-integrations`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteCesiumIntegration(
  orgId: string,
  integrationId: string
): Promise<{ success: boolean }> {
  if (!orgId || !integrationId) {
    throw new Error("organizationId and integrationId are required");
  }
  return apiRequest<{ success: boolean }>(
    `/api/organizations/${orgId}/cesium-integrations/${integrationId}`,
    {
      method: "DELETE",
    }
  );
}

export async function syncCesiumIntegration(
  orgId: string,
  integrationId: string
): Promise<SyncResult> {
  if (!orgId || !integrationId) {
    throw new Error("organizationId and integrationId are required");
  }
  return apiRequest<SyncResult>(
    `/api/organizations/${orgId}/cesium-integrations/${integrationId}/sync`,
    {
      method: "POST",
    }
  );
}

// ============================================================================
// Projects API
// ============================================================================

export interface Project {
  id: string;
  title: string;
  description: string | null;
  engine: "three" | "cesium";
  organizationId: string;
  sceneData: unknown;
  isPublished: boolean;
  isPublic: boolean;
  publishedUrl: string | null;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProjects(): Promise<{ projects: Project[] }> {
  return apiRequest<{ projects: Project[] }>("/api/projects");
}

export async function getProject(
  projectId: string
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`);
}

export async function createProject(data: {
  title?: string;
  description?: string;
  engine?: "three" | "cesium";
  organizationId: string; // Required: organization must be specified
}): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  projectId: string,
  data: {
    title?: string;
    description?: string;
    engine?: "three" | "cesium";
    thumbnail?: string | null;
  }
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateProjectThumbnail(
  projectId: string,
  thumbnailUrl: string | null,
  thumbnailSize?: number // Thumbnail file size in bytes
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ thumbnail: thumbnailUrl, thumbnailSize }),
  });
}

export async function updateProjectScene(
  projectId: string,
  sceneData: unknown
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "POST",
    body: JSON.stringify({ sceneData }),
  });
}

export async function publishProject(
  projectId: string
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ isPublished: true }),
  });
}

export async function updateProjectPublishSettings(
  projectId: string,
  settings: {
    isPublished?: boolean;
    isPublic?: boolean;
  }
): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export async function deleteProject(
  projectId: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Models/Assets API
// ============================================================================

export interface Asset {
  id: string;
  name?: string | null;
  originalFilename: string;
  fileUrl: string;
  fileType: string;
  organizationId: string;
  projectId?: string | null;
  assetType?: "model" | "cesiumIonAsset" | null;
  description?: string | null;
  thumbnail?: string | null;
  metadata?: Record<string, unknown> | null;
  fileSize?: bigint | number | null;
  cesiumAssetId?: string | null;
  cesiumApiKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportiveData {
  images?: Array<{
    url: string;
    caption?: string;
    uploadedAt?: string;
  }>;
  pdfs?: Array<{
    url: string;
    title?: string;
    uploadedAt?: string;
  }>;
  textDescriptions?: Array<{
    content: string;
    title?: string;
  }>;
  externalLinks?: Array<{
    url: string;
    label: string;
    description?: string;
  }>;
}

export interface Activity {
  id: string;
  organizationId: string;
  projectId?: string | null;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  project?: {
    id: string;
    title: string;
  } | null;
}

export interface StockModel {
  name: string;
  url: string;
  type: string;
}

export interface ModelsResponse {
  assets: Asset[];
  stockModels: StockModel[];
}

export async function getModels(params?: {
  assetType?: "model" | "cesiumIonAsset";
  organizationId?: string;
}): Promise<ModelsResponse> {
  return apiRequest<ModelsResponse>("/api/models", { params });
}

export async function getModel(assetId: string): Promise<{ asset: Asset }> {
  return apiRequest<{ asset: Asset }>(`/api/models/${assetId}`);
}

export async function getModelMetadata(
  assetId: string
): Promise<{ metadata: Asset["metadata"] }> {
  return apiRequest<{ metadata: Asset["metadata"] }>(`/api/models/metadata`, {
    params: { assetId },
  });
}

export async function updateModelTransform(
  assetId: string,
  data: {
    transform: number[]; // 16-element array
    longitude: number;
    latitude: number;
    height: number;
  }
): Promise<{ success: boolean; asset: Asset; warning?: string }> {
  return apiRequest<{ success: boolean; asset: Asset; warning?: string }>(
    `/api/models/${encodeURIComponent(assetId)}/transform`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Update asset metadata including supportive data.
 *
 * To update supportive data, pass it in the metadata object:
 * updateModelMetadata(assetId, {
 *   metadata: {
 *     ...existingMetadata,
 *     supportiveData: { images: [...], pdfs: [...], ... }
 *   }
 * })
 */
export async function updateModelMetadata(
  assetId: string,
  data: {
    name?: string;
    description?: string;
    metadata?: Asset["metadata"]; // Can include supportiveData: SupportiveData
    thumbnail?: string;
    thumbnailSize?: number; // Thumbnail file size in bytes
  }
): Promise<{ asset: Asset }> {
  return apiRequest<{ asset: Asset }>(`/api/models/metadata`, {
    method: "PATCH",
    body: JSON.stringify({ assetId, ...data }),
  });
}

export async function deleteModel(assetId: string): Promise<void> {
  return apiRequest<void>(`/api/models`, {
    method: "DELETE",
    body: JSON.stringify({ assetId }),
  });
}

// Get signed URL for model upload (PATCH endpoint)
export async function getModelUploadUrl(data: {
  fileName: string;
  fileType: string;
}): Promise<{ signedUrl: string; key: string; acl: string }> {
  return apiRequest<{ signedUrl: string; key: string; acl: string }>(
    "/api/models",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

// Get signed URL for thumbnail upload (PATCH endpoint)
export async function getThumbnailUploadUrl(data: {
  fileName: string;
  fileType: string;
}): Promise<{ signedUrl: string; key: string; acl: string }> {
  return apiRequest<{ signedUrl: string; key: string; acl: string }>(
    "/api/models",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

// Get signed URL for supportive data file upload (images, PDFs) (PATCH endpoint)
export async function getSupportiveDataUploadUrl(data: {
  fileName: string;
  fileType: string;
}): Promise<{ signedUrl: string; key: string; acl: string }> {
  return apiRequest<{ signedUrl: string; key: string; acl: string }>(
    "/api/models",
    {
      method: "PATCH",
      body: JSON.stringify({ ...data, prefix: "supportive-data" }),
    }
  );
}

// Upload file to signed URL (external fetch - but wrapped here for consistency)
export async function uploadToSignedUrl(
  signedUrl: string,
  file: File | Blob,
  options?: {
    onProgress?: (progress: number) => void;
    contentType?: string;
    acl?: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options?.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          options.onProgress!(progress);
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(`Upload failed: ${xhr.statusText}`, xhr.status));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("Upload failed: network error", 0));
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiError("Upload aborted", 0));
    });

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      options?.contentType || file.type || "application/octet-stream"
    );
    if (options?.acl) {
      xhr.setRequestHeader("x-amz-acl", options.acl);
    }
    xhr.send(file);
  });
}

// Create asset record after upload
export async function createModelAsset(data: {
  key: string;
  originalFilename: string;
  name?: string;
  fileType: string;
  thumbnail?: string | null;
  thumbnailSize?: number; // Thumbnail file size in bytes
  metadata?: Record<string, unknown>;
  description?: string;
  organizationId?: string;
  fileSize?: number; // File size in bytes
}): Promise<{ asset: Asset }> {
  return apiRequest<{ asset: Asset }>("/api/models", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Create Cesium Ion asset record
export async function createCesiumIonAsset(data: {
  assetType: "cesiumIonAsset";
  cesiumAssetId: string;
  name: string;
  cesiumApiKey?: string;
  description?: string;
  thumbnail?: string | null;
  metadata?: Record<string, unknown>;
  organizationId?: string;
}): Promise<{ asset: Asset }> {
  return apiRequest<{ asset: Asset }>("/api/models", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface AssetType {
  value: string;
  label: string;
}

export async function getAssetTypes(params?: {
  organizationId?: string;
  assetType?: "cesiumIonAsset";
}): Promise<{ types: AssetType[] }> {
  return apiRequest<{ types: AssetType[] }>("/api/models/types", { params });
}

// ============================================================================
// Activity API
// ============================================================================

export interface ActivitiesResponse {
  activities: Activity[];
  total?: number;
}

export async function getActivities(params?: {
  limit?: number;
  skip?: number;
  take?: number;
  organizationId?: string;
}): Promise<ActivitiesResponse> {
  return apiRequest<ActivitiesResponse>("/api/activity", { params });
}

export const activitiesFetcher = (url: string): Promise<ActivitiesResponse> => {
  return apiRequest<ActivitiesResponse>(url);
};

// ============================================================================
// Ion Upload API
// ============================================================================

export interface IonUploadResponse {
  assetId: string;
  onComplete: {
    url: string;
    method: string;
  };
}

export async function createIonAsset(data: {
  name: string;
  description?: string;
  type: string;
  accessToken?: string;
  integrationId?: string;
  options?: Record<string, unknown>;
}): Promise<
  IonUploadResponse & { assetMetadata?: unknown; uploadLocation?: unknown }
> {
  return apiRequest<
    IonUploadResponse & { assetMetadata?: unknown; uploadLocation?: unknown }
  >("/api/ion-upload", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function completeIonUpload(data: {
  onComplete: {
    url: string;
    method: string;
  };
  accessToken?: string;
  integrationId?: string;
}): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/api/ion-upload", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ============================================================================
// SWR Fetchers (for use with useSWR hook)
// ============================================================================

/**
 * Generic fetcher for SWR
 * Use specific fetchers below for type safety
 */
export const swrFetcher = <T>(url: string): Promise<T> => {
  return apiRequest<T>(url);
};

/**
 * Fetcher for projects list
 */
export const projectsFetcher = (url: string): Promise<Project[]> => {
  return apiRequest<{ projects: Project[] }>(url).then((res) => res.projects);
};

/**
 * Fetcher for single project
 */
export const projectFetcher = (url: string): Promise<Project> => {
  return apiRequest<{ project: Project }>(url).then((res) => res.project);
};

/**
 * Fetcher for models/assets
 * Supports assetType as query parameter in URL or as second argument
 */
export const modelsFetcher = (
  url: string,
  assetType?: "model" | "cesiumIonAsset"
): Promise<ModelsResponse> => {
  // If URL already has assetType query param, use it as-is
  // Otherwise, add it from the parameter
  const urlObj = new URL(url, "http://localhost");
  const hasAssetTypeInUrl = urlObj.searchParams.has("assetType");

  // Only add params if URL doesn't already have assetType
  const params = !hasAssetTypeInUrl && assetType ? { assetType } : undefined;

  return apiRequest<ModelsResponse>(url, { params });
};

/**
 * Fetcher for single model/asset
 */
export const modelFetcher = (url: string): Promise<Asset> => {
  return apiRequest<{ asset: Asset }>(url).then((res) => res.asset);
};

/**
 * Fetcher for user
 */
export const userFetcher = (url: string): Promise<User> => {
  return apiRequest<{ user: User }>(url).then((res) => res.user);
};

/**
 * Fetcher for organization
 */
export const organizationFetcher = (url: string): Promise<Organization> => {
  return apiRequest<{ organization: Organization }>(url).then(
    (res) => res.organization
  );
};

/**
 * Fetcher for organizations list
 */
export const organizationsFetcher = (url: string): Promise<Organization[]> => {
  return apiRequest<{ organizations: Organization[] }>(url).then(
    (res) => res.organizations
  );
};

// ============================================================================
// Plans & Billing API
// ============================================================================

export async function getPlans(): Promise<{ plans: Plan[] }> {
  return apiRequest<{ plans: Plan[] }>("/api/plans");
}

export async function createCheckoutSession(
  orgId: string,
  planCode: string,
  billingInterval: "monthly" | "yearly"
): Promise<{ url: string }> {
  return apiRequest<{ url: string }>(
    `/api/organizations/${orgId}/billing/checkout`,
    {
      method: "POST",
      body: JSON.stringify({ planCode, billingInterval }),
    }
  );
}

export async function createOrganizationCheckoutSession(
  planCode: string,
  billingInterval: "monthly" | "yearly",
  orgName: string,
  orgSlug: string
): Promise<{ url: string; bypassed?: boolean }> {
  return apiRequest<{ url: string; bypassed?: boolean }>(
    "/api/organizations/create-checkout",
    {
      method: "POST",
      body: JSON.stringify({ planCode, billingInterval, orgName, orgSlug }),
    }
  );
}

// Export ApiError for error handling
export { ApiError };
