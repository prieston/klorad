import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Session } from "next-auth";
import { isUserMemberOfOrganization } from "@/lib/organizations";

type RouteContext = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  // Try to get session, but allow unauthenticated access for published projects
  let session: Session | null = null;
  try {
    session = (await auth()) as Session;
  } catch {
    session = null;
  }

  const { assetId } = (await context.params);
  if (!assetId) {
    return NextResponse.json(
      { error: "Asset ID is required" },
      { status: 400 }
    );
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: {
        id: assetId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check if request includes projectId query parameter (from published world)
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    let allowPublicAccess = false;

    if (projectId) {
      // Verify the project exists, is published, and contains this asset
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          isPublished: true,
          sceneData: true,
          organizationId: true,
        },
      });

      if (project && project.isPublished && project.organizationId === asset.organizationId) {
        // Check if asset is used in this project's scene data
        const sceneData = project.sceneData as { objects?: Array<{ assetId?: string }> } | null;
        const objects = sceneData?.objects || [];
        const assetUsedInProject = objects.some((obj) => obj.assetId === assetId);

        if (assetUsedInProject) {
          allowPublicAccess = true;
        }
      }
    }

    // If not allowed public access, require authentication
    if (!allowPublicAccess) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Verify user is a member of the asset's organization
      const isMember = await isUserMemberOfOrganization(
        session.user.id,
        asset.organizationId
      );
      if (!isMember) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Convert BigInt fileSize and thumbnailSize to number for JSON serialization
    const serializedAsset = {
      ...asset,
      fileSize: asset.fileSize ? Number(asset.fileSize) : null,
      thumbnailSize: asset.thumbnailSize ? Number(asset.thumbnailSize) : null,
    };
    return NextResponse.json({ asset: serializedAsset });
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
