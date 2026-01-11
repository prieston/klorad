import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Session } from "next-auth";
import { serverEnv } from "@/lib/env/server";
import {
  getUserOrganizationIds,
  isUserMemberOfOrganization,
} from "@/lib/organizations";
import { logActivity } from "@/lib/activity";
import { decryptToken } from "@/lib/cesium/encryption";

const CESIUM_ION_API_BASE = "https://api.cesium.com/v1";

interface StockModel {
  name: string;
  url: string;
  type: string;
}

// Hard-coded stock models.
const stockModels: StockModel[] = [
  {
    name: "House",
    url: "https://prieston-prod.fra1.cdn.digitaloceanspaces.com/general/house.glb",
    type: "glb",
  },
  {
    name: "CNC",
    url: "https://prieston-prod.fra1.cdn.digitaloceanspaces.com/general/cnc.glb",
    type: "glb",
  },
];

// GET: List both stock models and user's uploaded assets.
export async function GET(request: NextRequest) {
  const session = (await auth()) as Session;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const assetType = searchParams.get("assetType"); // Optional: "model" | "cesiumIonAsset"
    const organizationId = searchParams.get("organizationId");

    // Require organizationId for security
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Verify user is a member of the specified organization
    const userOrgIds = await getUserOrganizationIds(userId);
    if (!userOrgIds.includes(organizationId)) {
      return NextResponse.json(
        { error: "User is not a member of the specified organization" },
        { status: 403 }
      );
    }

    // Build where clause - filter by specific organization
    const whereClause: any = {
      organizationId,
    };

    // Add assetType filter if provided
    // Explicitly filter to ensure only the requested type is returned
    // Use Prisma enum values directly
    if (assetType === "model") {
      whereClause.assetType = "model" as const;
    } else if (assetType === "cesiumIonAsset") {
      whereClause.assetType = "cesiumIonAsset" as const;
    }
    // If no assetType specified, don't filter (show all)

    const assets = await prisma.asset.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Convert BigInt fileSize and thumbnailSize to number for JSON serialization
    const serializedAssets = assets.map((asset) => ({
      ...asset,
      fileSize: asset.fileSize ? Number(asset.fileSize) : null,
      thumbnailSize: asset.thumbnailSize ? Number(asset.thumbnailSize) : null,
    }));

    return NextResponse.json({ stockModels, assets: serializedAssets });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Generate a signed URL for uploading a file to DigitalOcean Spaces.
 *
 * Note: This endpoint only generates signed URLs for file uploads.
 * The actual asset record is created via POST /api/models which requires organizationId.
 * This endpoint is authenticated but does not require organizationId as it's a utility endpoint.
 */
export async function PATCH(request: NextRequest) {
  const session = (await auth()) as Session;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { fileName, fileType, prefix } = await request.json();
    if (!fileName || !fileType) {
      return NextResponse.json({ error: "Missing file data" }, { status: 400 });
    }
    // Configure the S3 client for DigitalOcean Spaces.
    const s3 = new S3Client({
      region: serverEnv.DO_SPACES_REGION,
      endpoint: serverEnv.DO_SPACES_ENDPOINT,
      credentials: {
        accessKeyId: serverEnv.DO_SPACES_KEY,
        secretAccessKey: serverEnv.DO_SPACES_SECRET,
      },
    });
    const bucketName = serverEnv.DO_SPACES_BUCKET;
    // Use provided prefix (e.g., "supportive-data") or default to "models"
    const folderPrefix = prefix || "models";
    const key = `${folderPrefix}/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
      ACL: "public-read",
    });
    // Generate a signed URL valid for 1 hour.
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.json({ signedUrl, key, acl: "public-read" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: Create a new Asset record once the file has been uploaded.
export async function POST(request: NextRequest) {
  const session = (await auth()) as Session;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  try {
    // Expecting a JSON body with key, originalFilename, name, fileType, thumbnail, metadata
    // OR for Cesium Ion assets: assetType, cesiumAssetId, cesiumApiKey, name
    const body = await request.json();

    const {
      key,
      originalFilename,
      name,
      fileType,
      thumbnail,
      thumbnailSize, // Thumbnail file size in bytes
      metadata,
      assetType,
      cesiumAssetId,
      cesiumApiKey,
      description,
      organizationId, // Required: organization must be specified
      fileSize, // File size in bytes
    } = body;

    // Require organizationId for security
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Verify user is a member of the target organization
    const userOrgIds = await getUserOrganizationIds(userId);
    if (!userOrgIds.includes(organizationId)) {
      return NextResponse.json(
        { error: "User is not a member of the specified organization" },
        { status: 403 }
      );
    }

    // Handle Cesium Ion Asset
    if (assetType === "cesiumIonAsset") {
      if (!cesiumAssetId) {
        return NextResponse.json(
          { error: "Missing cesiumAssetId for Cesium Ion asset" },
          { status: 400 }
        );
      }
      if (!name) {
        return NextResponse.json(
          { error: "Missing name for Cesium Ion asset" },
          { status: 400 }
        );
      }

      // Resolve cesiumApiKey: if it starts with "integration:", fetch the read token
      let finalCesiumApiKey: string | null = cesiumApiKey || null;
      if (cesiumApiKey && cesiumApiKey.startsWith("integration:")) {
        const integrationId = cesiumApiKey.replace("integration:", "");

        // Fetch integration and decrypt read token
        const integration = await prisma.cesiumIonIntegration.findUnique({
          where: { id: integrationId },
          select: {
            id: true,
            organizationId: true,
            readToken: true,
            readTokenValid: true,
          },
        });

        if (!integration) {
          return NextResponse.json(
            { error: "Integration not found" },
            { status: 404 }
          );
        }

        // Verify integration belongs to the organization
        if (integration.organizationId !== organizationId) {
          return NextResponse.json(
            { error: "Integration does not belong to this organization" },
            { status: 403 }
          );
        }

        if (!integration.readTokenValid) {
          return NextResponse.json(
            { error: "Integration read token is not valid" },
            { status: 400 }
          );
        }

        // Decrypt and use the read token
        finalCesiumApiKey = decryptToken(integration.readToken);
      }

      const asset = await prisma.asset.create({
        data: {
          organizationId,
          assetType: "cesiumIonAsset",
          fileUrl: `cesium://ion/${cesiumAssetId}`, // Placeholder URL
          fileType: "cesium-ion-tileset",
          originalFilename: name,
          name,
          description: description || null,
          thumbnail: thumbnail || null,
          thumbnailSize: thumbnailSize ? BigInt(thumbnailSize) : null,
          cesiumAssetId,
          cesiumApiKey: finalCesiumApiKey,
          metadata: metadata || {},
          fileSize: fileSize ? BigInt(fileSize) : null,
        },
      });

      // Log activity
      await logActivity({
        organizationId,
        projectId: null, // Org-level activity
        actorId: userId,
        entityType: "GEOSPATIAL_ASSET",
        entityId: asset.id,
        action: "CREATED",
        message: `Geospatial tileset "${name}" uploaded`,
        metadata: { assetName: name, assetType: "cesiumIonAsset" },
      });

      // Convert BigInt fileSize and thumbnailSize to number for JSON serialization
      const serializedAsset = {
        ...asset,
        fileSize: asset.fileSize ? Number(asset.fileSize) : null,
        thumbnailSize: asset.thumbnailSize ? Number(asset.thumbnailSize) : null,
      };
      return NextResponse.json({ asset: serializedAsset });
    }

    // Handle Regular Model Upload
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }
    if (!originalFilename) {
      return NextResponse.json(
        { error: "Missing originalFilename" },
        { status: 400 }
      );
    }
    if (!fileType) {
      return NextResponse.json({ error: "Missing fileType" }, { status: 400 });
    }

    // Construct the public file URL from your DigitalOcean Spaces bucket
    const fileUrl = `${serverEnv.DO_SPACES_ENDPOINT}/${serverEnv.DO_SPACES_BUCKET}/${key}`;

    // Convert metadata array to object format
    // Handle both array format (from form) and object format (already converted)
    let metadataObject: Record<string, string> = {};
    if (metadata) {
      if (Array.isArray(metadata)) {
        metadataObject = metadata.reduce(
          (
            acc: Record<string, string>,
            field: { label: string; value: string }
          ) => {
            if (field.label && field.value) {
              acc[field.label] = field.value;
            }
            return acc;
          },
          {}
        );
      } else if (typeof metadata === "object") {
        // Already an object, use it directly
        metadataObject = metadata as Record<string, string>;
      }
    }

    const asset = await prisma.asset.create({
      data: {
        organizationId,
        assetType: "model",
        fileUrl,
        originalFilename,
        name: name || originalFilename, // Use provided name or fallback to originalFilename
        description: description || null,
        fileType,
        thumbnail: thumbnail || null,
        thumbnailSize: thumbnailSize ? BigInt(thumbnailSize) : null,
        metadata: metadataObject,
        fileSize: fileSize ? BigInt(fileSize) : null,
      },
    });

    // Log activity
    await logActivity({
      organizationId,
      projectId: null, // Org-level activity (could be linked to project later)
      actorId: userId,
      entityType: "MODEL",
      entityId: asset.id,
      action: "CREATED",
      message: `Model "${name || originalFilename}" uploaded`,
      metadata: { assetName: name || originalFilename, assetType: "model" },
    });

    // Convert BigInt fileSize and thumbnailSize to number for JSON serialization
    const serializedAsset = {
      ...asset,
      fileSize: asset.fileSize ? Number(asset.fileSize) : null,
      thumbnailSize: asset.thumbnailSize ? Number(asset.thumbnailSize) : null,
    };
    return NextResponse.json({ asset: serializedAsset });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an asset from DigitalOcean Spaces and the database.
export async function DELETE(request: NextRequest) {
  const session = (await auth()) as Session;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  try {
    // Expecting a JSON body with assetId.
    const { assetId } = await request.json();
    if (!assetId) {
      return NextResponse.json({ error: "Asset ID missing" }, { status: 400 });
    }
    // Retrieve asset from database.
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    // Check if user is a member of the asset's organization
    const isMember = await isUserMemberOfOrganization(
      userId,
      asset.organizationId
    );
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Handle Cesium Ion asset deletion
    if (asset.assetType === "cesiumIonAsset" && asset.cesiumAssetId) {
      // Find the integration that owns this asset
      const cesiumAsset = await prisma.cesiumAsset.findFirst({
        where: {
          organizationId: asset.organizationId,
          cesiumAssetId: asset.cesiumAssetId,
        },
        include: {
          integration: true,
        },
      });

      if (cesiumAsset && cesiumAsset.integration.uploadTokenValid) {
        try {
          // Decrypt upload token
          const uploadToken = decryptToken(cesiumAsset.integration.uploadToken);

          // Delete asset from Cesium Ion
          const deleteResponse = await fetch(
            `${CESIUM_ION_API_BASE}/assets/${asset.cesiumAssetId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${uploadToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            // 404 means asset already deleted, which is fine
            const errorText = await deleteResponse.text();
            console.error(
              `Failed to delete Cesium Ion asset ${asset.cesiumAssetId}:`,
              errorText
            );
            // Continue with local deletion even if Cesium deletion fails
          }
        } catch (error) {
          console.error(
            `Error deleting Cesium Ion asset ${asset.cesiumAssetId}:`,
            error
          );
          // Continue with local deletion even if Cesium deletion fails
        }
      }
    } else {
      // Delete regular asset from DigitalOcean Spaces
      // Determine the key from the asset's fileUrl.
      const bucketName = serverEnv.DO_SPACES_BUCKET;
      const endpoint = serverEnv.DO_SPACES_ENDPOINT;
      const fileUrl = asset.fileUrl;

      // Only delete from Spaces if it's not a Cesium Ion placeholder URL
      if (!fileUrl.startsWith("cesium-ion://")) {
        const key = fileUrl.replace(`${endpoint}/${bucketName}/`, "");
        // Setup S3 client.
        const s3 = new S3Client({
          region: serverEnv.DO_SPACES_REGION,
          endpoint: endpoint,
          credentials: {
            accessKeyId: serverEnv.DO_SPACES_KEY,
            secretAccessKey: serverEnv.DO_SPACES_SECRET,
          },
        });
        // Delete the object from Spaces.
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        await s3.send(deleteCommand);
      }
    }

    // Log activity before deleting
    const entityType =
      asset.assetType === "cesiumIonAsset" ? "GEOSPATIAL_ASSET" : "MODEL";
    await logActivity({
      organizationId: asset.organizationId,
      projectId: asset.projectId || null,
      actorId: userId,
      entityType,
      entityId: assetId,
      action: "DELETED",
      message: `Asset "${asset.name || asset.originalFilename}" deleted`,
      metadata: { assetName: asset.name || asset.originalFilename },
    });

    // Delete the asset record from the database.
    await prisma.asset.delete({
      where: { id: assetId },
    });
    return NextResponse.json({ message: "Asset deleted successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
