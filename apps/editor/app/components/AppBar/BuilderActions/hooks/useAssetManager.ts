"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";
import { dataURLtoBlob } from "@klorad/ui";
import { clientEnv } from "@/lib/env/client";
import type { LibraryAsset } from "@klorad/ui";
import {
  getModels,
  getModelUploadUrl,
  getThumbnailUploadUrl,
  uploadToSignedUrl,
  createModelAsset,
  deleteModel,
  updateModelMetadata,
} from "@/app/utils/api";
import { useOrgId } from "@/app/hooks/useOrgId";
import { extractTransformFromMetadata } from "@klorad/engine-cesium";

interface UseAssetManagerProps {
  setSelectingPosition?: (selecting: boolean) => void;
  setSelectedPosition?: (position: [number, number, number] | null) => void;
  setPendingModel?: (model: any) => void;
}

export const useAssetManager = ({
  setSelectingPosition,
  setSelectedPosition,
  setPendingModel,
}: UseAssetManagerProps) => {
  const orgId = useOrgId();
  const [userAssets, setUserAssets] = useState<LibraryAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addCesiumIonAsset = useSceneStore((s) => s.addCesiumIonAsset);
  const addModel = useSceneStore((state) => state.addModel);

  const fetchUserAssets = useCallback(async () => {
    try {
      if (!orgId) {
        console.warn("Organization ID not available, cannot fetch models");
        return;
      }
      const data = await getModels({ organizationId: orgId });
      // Convert Asset[] to LibraryAsset[]
      // Note: LibraryAsset.metadata is typed as Record<string, string> but we preserve
      // the full structure (including nested supportiveData) by casting to unknown first
      const libraryAssets: LibraryAsset[] = (data.assets || []).map((asset) => ({
        id: asset.id,
        name: asset.name || asset.originalFilename || "",
        originalFilename: asset.originalFilename,
        fileUrl: asset.fileUrl,
        fileType: asset.fileType,
        thumbnail: asset.thumbnail || undefined,
        description: asset.description || undefined,
        metadata: asset.metadata as unknown as Record<string, string> | undefined,
        assetType: asset.assetType,
        cesiumAssetId: asset.cesiumAssetId || undefined,
        cesiumApiKey: asset.cesiumApiKey || undefined,
      }));
      setUserAssets(libraryAssets);
    } catch (err) {
      console.error("Error fetching models:", err);
      showToast("Failed to load models");
    }
  }, [orgId]);

  // Fetch user's uploaded models when component mounts
  useEffect(() => {
    fetchUserAssets();
  }, [fetchUserAssets]);

  // Handle custom model upload
  const handleCustomModelUpload = async (data: {
    file: File;
    friendlyName: string;
    metadata: Array<{ label: string; value: string }>;
    screenshot: string | null;
  }) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL for model file
      const { signedUrl, key, acl } = await getModelUploadUrl({
        fileName: data.file.name,
        fileType: data.file.type,
      });

      // Step 2: Upload model file directly to S3 using presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            );
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", data.file.type);
        if (acl) {
          xhr.setRequestHeader("x-amz-acl", acl);
        }
        xhr.send(data.file);
      });

      // Upload thumbnail if available (using presigned URL)
      let thumbnailUrl = null;
      let thumbnailSize: number | undefined = undefined;
      if (data.screenshot) {
        const thumbnailBlob = dataURLtoBlob(data.screenshot);
        thumbnailSize = thumbnailBlob.size;
        const thumbnailFileName = `${data.friendlyName}-thumbnail.png`;

        // Get presigned URL for thumbnail
        const {
          signedUrl: thumbSignedUrl,
          key: thumbKey,
          acl: thumbAcl,
        } = await getThumbnailUploadUrl({
          fileName: thumbnailFileName,
          fileType: "image/png",
        });

        // Upload thumbnail directly to S3
        await uploadToSignedUrl(thumbSignedUrl, thumbnailBlob, {
          contentType: "image/png",
          acl: thumbAcl,
        });

        // Construct thumbnail URL
        thumbnailUrl = `${clientEnv.NEXT_PUBLIC_DO_SPACES_ENDPOINT}/${clientEnv.NEXT_PUBLIC_DO_SPACES_BUCKET}/${thumbKey}`;
      }

      // Step 3: Save model metadata to database
      // Convert metadata array to object
      const metadataObject = data.metadata.reduce(
        (acc, item) => {
          if (item.label && item.value) {
            acc[item.label] = item.value;
          }
          return acc;
        },
        {} as Record<string, string>
      );

      if (!orgId) {
        throw new Error("Organization ID is required");
      }

      const { asset: newModel } = await createModelAsset({
        key: key,
        originalFilename: data.file.name,
        name: data.friendlyName,
        fileType: data.file.type,
        thumbnail: thumbnailUrl,
        thumbnailSize: thumbnailSize,
        metadata: metadataObject,
        fileSize: data.file.size,
        organizationId: orgId,
      });
      showToast("Model uploaded and added to library!");
      // Convert Asset to LibraryAsset
      const libraryAsset: LibraryAsset = {
        id: newModel.id,
        name: newModel.name || newModel.originalFilename || "",
        originalFilename: newModel.originalFilename,
        fileUrl: newModel.fileUrl,
        fileType: newModel.fileType,
        thumbnail: newModel.thumbnail || undefined,
        description: newModel.description || undefined,
        metadata: newModel.metadata as Record<string, string> | undefined,
        assetType: newModel.assetType,
      };
      setUserAssets((prev) => [...prev, libraryAsset]);

      // Automatically add to scene
      handleModelSelect(libraryAsset);
    } catch (error) {
      console.error("Upload error:", error);
      showToast("An error occurred during upload.");
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle model selection (trigger positioning mode)
  const handleModelSelect = (model: LibraryAsset) => {
    // Check if this is a Cesium Ion asset
    const isCesiumAsset =
      (model as any).assetType === "cesiumIonAsset" ||
      (model as any).cesiumAssetId;

    if (isCesiumAsset) {
      // Extract transform from metadata using shared utility function
      const metadata = (model as any).metadata as Record<string, unknown> | undefined;
      const transformToPass = extractTransformFromMetadata(metadata);

      // For Cesium Ion assets, add to both cesiumIonAssets and objects arrays
      addCesiumIonAsset({
        name: model.name || model.originalFilename,
        apiKey: (model as any).cesiumApiKey || "",
        assetId: (model as any).cesiumAssetId,
        enabled: true,
        transform: transformToPass,
      });

      // Also add to objects array so it appears in scene objects list
      // Use model.id (database asset ID) for assetId so metadata can be fetched correctly
      addModel({
        name: model.name || model.originalFilename,
        type: "cesium-ion-tileset",
        apiKey: (model as any).cesiumApiKey,
        assetId: model.id, // Use database asset ID for metadata fetching, not Cesium Ion asset ID
        cesiumAssetId: (model as any).cesiumAssetId, // Store Cesium Ion asset ID for fly-to matching
        position: [0, 0, 0], // Placeholder, actual position handled by Cesium
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
      });

      showToast(
        `Added Cesium Ion asset: ${model.name || model.originalFilename}`
      );
      return;
    }

    // For regular models, trigger positioning mode
    if (setPendingModel && setSelectingPosition && setSelectedPosition) {
      // Store the model temporarily and enter positioning mode
      setPendingModel({
        name: model.name || model.originalFilename,
        url: model.fileUrl,
        type: model.fileType,
        fileType: model.fileType,
        assetId: model.id,
      });
      setSelectedPosition(null);
      setSelectingPosition(true);
      showToast("Click anywhere in the scene to position the model");
    } else {
      // Fallback: add directly at origin if positioning not available
      addModel({
        name: model.name || model.originalFilename,
        url: model.fileUrl,
        type: model.fileType,
        position: [0, 0, 0],
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
      });
      showToast(`Added ${model.name || model.originalFilename} to scene`);
    }
  };

  // Handle model deletion
  const handleDeleteModel = async (assetId: string) => {
    try {
      await deleteModel(assetId);
      showToast("Asset deleted successfully.");
      setUserAssets((prev) => prev.filter((asset) => asset.id !== assetId));
    } catch (error) {
      console.error("Delete error:", error);
      showToast("An error occurred during deletion.");
    }
  };

  // Handle asset update (name, description, metadata, thumbnail)
  const handleAssetUpdate = async (
    assetId: string,
    updates: {
      name?: string;
      description?: string;
      metadata?: Record<string, string>;
      thumbnail?: string;
    }
  ) => {
    try {
      const data = await updateModelMetadata(assetId, updates);
      showToast("Asset updated successfully.");
      // Update local state with the returned asset data
      // Note: Preserve full metadata structure including nested supportiveData
      const updatedLibraryAsset: LibraryAsset = {
        id: data.asset.id,
        name: data.asset.name || data.asset.originalFilename || "",
        originalFilename: data.asset.originalFilename,
        fileUrl: data.asset.fileUrl,
        fileType: data.asset.fileType,
        thumbnail: data.asset.thumbnail || undefined,
        description: data.asset.description || undefined,
        metadata: data.asset.metadata as unknown as Record<string, string> | undefined,
        assetType: data.asset.assetType,
        cesiumAssetId: data.asset.cesiumAssetId || undefined,
        cesiumApiKey: data.asset.cesiumApiKey || undefined,
      };
      setUserAssets((prev) =>
        prev.map((asset) =>
          asset.id === assetId ? updatedLibraryAsset : asset
        )
      );
    } catch (error) {
      console.error("Asset update error:", error);
      showToast("An error occurred while updating asset.");
    }
  };

  return {
    userAssets,
    uploading,
    uploadProgress,
    handleCustomModelUpload,
    handleModelSelect,
    handleDeleteModel,
    handleAssetUpdate,
    fetchUserAssets,
  };
};
