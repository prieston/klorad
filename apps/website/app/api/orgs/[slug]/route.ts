import { NextResponse } from "next/server";
import { prisma } from "@klorad/prisma";

type RouteParams = {
  params: Promise<{ slug: string }>;
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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId: organization.id,
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

    const normalizedProjects = projects.map((project) => ({
      ...project,
      publishedUrl: normalizeUrl(project.publishedUrl),
      thumbnail: project.thumbnail || undefined,
      description: project.description || undefined,
      updatedAt: project.updatedAt.toISOString(), // Convert Date to string for JSON serialization
    }));

    return NextResponse.json({
      organization,
      projects: normalizedProjects,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}
