"use client";

import { showToast } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";
import {
  useCesiumIonUpload,
  type CesiumIonUploadData,
} from "@klorad/engine-cesium";
import { createIonAsset, completeIonUpload, createCesiumIonAsset, updateModelMetadata, getModel } from "@/app/utils/api";
import { useOrgId } from "@/app/hooks/useOrgId";

/**
 * App-specific Cesium Ion hook that wraps the generic engine-cesium hook
 * with application API integration logic
 */
export const useCesiumIon = () => {
  const orgId = useOrgId();
  const {
    ionUploading,
    ionUploadProgress,
    setIonUploading,
    setIonUploadProgress,
    pollAssetStatus,
    mapSourceType,
    uploadToS3,
  } = useCesiumIonUpload();

  const addCesiumIonAsset = useSceneStore((s) => s.addCesiumIonAsset);
  const addModel = useSceneStore((state) => state.addModel);

  // Handle Cesium Ion asset addition (save to app database)
  const handleCesiumAssetAdd = async (data: {
    assetId: string;
    name: string;
    apiKey?: string;
  }) => {
    try {
      if (!orgId) {
        throw new Error("Organization ID is required");
      }

      // Save to database
      const { asset: newAsset } = await createCesiumIonAsset({
        assetType: "cesiumIonAsset",
        cesiumAssetId: data.assetId,
        cesiumApiKey: data.apiKey,
        name: data.name,
        organizationId: orgId,
      });
      showToast(`Saved Cesium Ion asset: ${data.name}`);

      // Fetch the asset to get metadata/transform if it exists
      let transform: { matrix: number[]; longitude?: number; latitude?: number; height?: number } | undefined;
      try {
        const fetchedAsset = await getModel(newAsset.id);
        const metadata = fetchedAsset.asset?.metadata as Record<string, unknown> | undefined;
        const savedTransform = metadata?.transform as
          | {
              matrix: number[];
              longitude?: number;
              latitude?: number;
              height?: number;
            }
          | undefined;
        if (savedTransform?.matrix && Array.isArray(savedTransform.matrix) && savedTransform.matrix.length === 16) {
          transform = {
            matrix: savedTransform.matrix,
            longitude: savedTransform.longitude,
            latitude: savedTransform.latitude,
            height: savedTransform.height,
          };
        }
      } catch (err) {
        // Ignore errors fetching asset metadata
      }

      // Add to scene store for immediate rendering (both arrays)
      addCesiumIonAsset({
        name: data.name,
        apiKey: data.apiKey || "",
        assetId: data.assetId, // Cesium Ion asset ID for rendering
        enabled: true,
        transform,
      });

      // Also add to objects array so it appears in scene objects list
      // Use newAsset.id (database asset ID) for assetId so metadata can be fetched correctly
      addModel({
        name: data.name,
        type: "cesium-ion-tileset",
        apiKey: data.apiKey,
        assetId: newAsset.id, // Use database asset ID for metadata fetching, not Cesium Ion asset ID
        cesiumAssetId: data.assetId, // Store Cesium Ion asset ID for fly-to matching
        position: [0, 0, 0], // Placeholder, actual position handled by Cesium
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
      });

      return newAsset;
    } catch (error) {
      console.error("Cesium Ion asset save error:", error);
      showToast("An error occurred while saving Cesium Ion asset.");
      throw error;
    }
  };

  // Save Cesium Ion asset to the library (immediately or after tiling completes)
  const saveCesiumIonAssetToLibrary = async (
    assetId: number,
    assetInfo: any,
    accessToken: string,
    onRefresh?: () => void
  ): Promise<{ asset: any }> => {
    // Determine tiling status
    const tilingStatus = assetInfo.status === "COMPLETE" ? "COMPLETE" :
                        assetInfo.status === "ERROR" || assetInfo.status === "FAILED" ? "ERROR" :
                        "IN_PROGRESS";

    // Save to your database via API
    if (!orgId) {
      throw new Error("Organization ID is required");
    }

    const { asset } = await createCesiumIonAsset({
      assetType: "cesiumIonAsset",
      cesiumAssetId: String(assetId),
      cesiumApiKey: accessToken,
      name: assetInfo.name || `Ion Asset ${assetId}`,
      description: assetInfo.description || "",
      metadata: {
        ionAssetId: String(assetId),
        tilingStatus,
        tilingProgress: assetInfo.percentComplete || (tilingStatus === "COMPLETE" ? 100 : 0),
        type: assetInfo.type,
        status: assetInfo.status,
        bytes: assetInfo.bytes,
      },
      organizationId: orgId,
    });

    // Refresh the library to show the new asset
    if (onRefresh) {
      onRefresh();
    }

    if (tilingStatus === "COMPLETE") {
      showToast("Ion asset added to your library!");
    }

    return { asset };
  };

  // Handle upload to Cesium Ion (integrated with app API)
  const handleUploadToIon = async (
    data: CesiumIonUploadData,
    onRefresh?: () => void
  ): Promise<{ assetId: string }> => {
    setIonUploading(true);
    setIonUploadProgress(0);

    try {
      const {
        file,
        name,
        description,
        sourceType,
        accessToken,
        integrationId,
        longitude,
        latitude,
        height,
        options,
      } = data;

      // Step 1: Create asset on Cesium Ion via app API
      setIonUploadProgress(10);

      const { ionType, uploadSourceType } = mapSourceType(sourceType);

      // Build Ion-compatible options
      const ionOptions: Record<string, unknown> = {};

      if (sourceType === "3DTILES_ARCHIVE") {
        ionOptions.sourceType = "3DTILES";
        ionOptions.tilesetJson = options?.tilesetJson || "tileset.json";
      } else if (sourceType === "PHOTOS_3D_RECONSTRUCTION") {
        // Pass through all 3D reconstruction options
        if (options) {
          Object.assign(ionOptions, options);
        }
      } else if (uploadSourceType) {
        ionOptions.sourceType = uploadSourceType;
      }

      // position: object shape { longitude, latitude, height }
      // Sets the origin point where Ion places the model on the globe
      if (longitude !== undefined && latitude !== undefined) {
        ionOptions.position = {
          longitude,
          latitude,
          height: height || 0,
        };
      }

      // inputCrs: "EPSG:xxxx" format for IFC without embedded CRS
      if (options?.epsgCode) {
        ionOptions.inputCrs = `EPSG:${options.epsgCode}`;
      }

      // geometryCompression: "MESHOPT" or "DRACO" for BIM/CAD.
      // Ion 409s ("options.sourceType must be a valid source type")
      // if this is present on non-BIM types like KML/GeoJSON/CZML —
      // it infers a BIM tiling flow and demands a matching sourceType.
      // Gate on `BIM_CAD` like `textureFormat` below already does.
      if (uploadSourceType === "BIM_CAD" && options?.geometricCompression) {
        const compression = options.geometricCompression.toUpperCase();
        if (compression === "MESHOPT" || compression === "DRACO") {
          ionOptions.geometryCompression = compression;
        }
      }

      // textureFormat: "KTX2" for BIM/CAD uploads
      if (uploadSourceType === "BIM_CAD" && options?.ktx2Compression) {
        ionOptions.textureFormat = "KTX2";
      }

      const createAssetResponse = await createIonAsset({
        name,
        description,
        type: ionType,
        ...(integrationId ? { integrationId } : { accessToken }),
        options: ionOptions,
      });

      const { assetId, assetMetadata, uploadLocation, onComplete } = createAssetResponse;

      // Prefer assetMetadata.id over assetId or regex parsing
      const metadata = assetMetadata as { id?: number } | undefined;
      const location = uploadLocation as { prefix?: string } | undefined;
      const inferredIdRaw =
        metadata?.id ??
        (typeof assetId === 'number' ? assetId : undefined) ??
        (typeof assetId === 'string' ? Number(assetId) : undefined) ??
        (() => {
          const match = /sources\/(\d+)\//.exec(location?.prefix || "");
          return match ? Number(match[1]) : undefined;
        })();

      if (!inferredIdRaw || isNaN(inferredIdRaw)) {
        throw new Error(
          "Ion response missing assetMetadata.id, assetId, and prefix; cannot proceed."
        );
      }
      const inferredId: number = inferredIdRaw;

      setIonUploadProgress(20);

      // Step 2: Upload file to S3
      await uploadToS3(file, uploadLocation, setIonUploadProgress);

      // Step 3: Notify Cesium Ion that upload is complete
      await completeIonUpload({ onComplete, accessToken });

      setIonUploadProgress(100);

      showToast(`Successfully uploaded to Cesium Ion! Asset ID: ${inferredId}`);

      // Save to library immediately with IN_PROGRESS status
      // This allows the asset to appear in the library right away
      const { asset: newAsset } = await saveCesiumIonAssetToLibrary(
        inferredId,
        {
          status: "IN_PROGRESS",
          percentComplete: 0,
          name: name,
          description: description,
        } as any,
        accessToken,
        onRefresh
      );

      // Start background polling to update tiling status
      // Don't await - let it run in the background
      // Pass file size to calculate appropriate timeout (larger files take longer to tile)
      pollAssetStatus(inferredId, accessToken, async (_status, _percent) => {
        // Update progress periodically
        try {
          await updateModelMetadata(newAsset.id, {
            metadata: {
              ...(newAsset.metadata as Record<string, any>),
              tilingProgress: _percent,
            },
          });
          if (onRefresh) {
            onRefresh();
          }
        } catch (err) {
          // Failed to update tiling progress
        }
      }, file.size)
        .then(async (assetInfo) => {
          // Update asset metadata when tiling completes
          try {
            await updateModelMetadata(newAsset.id, {
              metadata: {
                ...(newAsset.metadata as Record<string, any>),
                tilingStatus: "COMPLETE",
                tilingProgress: 100,
                type: assetInfo.type,
                status: assetInfo.status,
                bytes: assetInfo.bytes,
              },
            });
            if (onRefresh) {
              onRefresh();
            }
            showToast("Tiling completed! Asset is ready to use.");
          } catch (err) {
            // Failed to update tiling status
          }
        })
        .catch(async (err) => {
          // Polling error
          // Update status to ERROR
          try {
            await updateModelMetadata(newAsset.id, {
              metadata: {
                ...(newAsset.metadata as Record<string, any>),
                tilingStatus: "ERROR",
                error: err.message,
              },
            });
            if (onRefresh) {
              onRefresh();
            }
          } catch (updateErr) {
            // Failed to update error status
          }
          showToast(`Tiling status check failed: ${err.message}`);
        });

      return { assetId: String(inferredId) };
    } catch (error) {
      // Ion upload error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Cesium Ion upload failed: ${errorMessage}`);
      throw error;
    } finally {
      setIonUploading(false);
      setIonUploadProgress(0);
    }
  };

  return {
    ionUploading,
    ionUploadProgress,
    handleCesiumAssetAdd,
    handleUploadToIon,
  };
};
