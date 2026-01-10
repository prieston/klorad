import { prisma } from "@klorad/prisma";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type PublishedProject = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  publishedUrl: string;
  updatedAt: Date;
};

// Helper function to normalize URLs (convert relative to absolute)
const normalizeUrl = (url: string | null): string => {
  if (!url) return "";
  if (url.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return `${baseUrl}${url}`;
  }
  return url;
};

// Fetch all organizations
export async function getOrganizations(): Promise<Organization[]> {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return organizations;
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return [];
  }
}

// Fetch organization by slug
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return organization;
  } catch (error) {
    console.error("Error fetching organization by slug:", error);
    return null;
  }
}

// Fetch published projects for an organization
export async function getPublishedProjectsByOrg(orgId: string): Promise<PublishedProject[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        organizationId: orgId,
        isPublished: true,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        publishedUrl: true,
        updatedAt: true,
      },
    });

    return projects.map((project) => ({
      ...project,
      publishedUrl: normalizeUrl(project.publishedUrl),
      thumbnail: project.thumbnail || undefined,
      description: project.description || undefined,
    }));
  } catch (error) {
    console.error("Error fetching published projects by org:", error);
    return [];
  }
}
