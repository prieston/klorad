import { useState } from "react";
import { useWorldStore, useSceneStore } from "@klorad/core";
import {
  captureThreeJSScreenshot,
  captureCesiumScreenshot,
  captureMapboxScreenshot,
} from "@/app/utils/screenshotCapture";
import { showToast } from "@klorad/ui";
import {
  getThumbnailUploadUrl,
  uploadToSignedUrl,
  updateProjectThumbnail,
} from "@/app/utils/api";

interface UseProjectThumbnailCaptureProps {
  projectId?: string;
  onThumbnailUpdate?: () => void;
  onUploadComplete?: () => void;
}

export function useProjectThumbnailCapture({
  projectId,
  onThumbnailUpdate,
  onUploadComplete,
}: UseProjectThumbnailCaptureProps) {
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { engine } = useWorldStore();
  const sceneState = useSceneStore((s) => ({
    scene: s.scene,
    cesiumViewer: s.cesiumViewer,
    mapboxMap: s.mapboxMap,
  }));

  const captureScreenshot = async () => {
    try {
      if (engine === "three") {
        const dataUrl = captureThreeJSScreenshot(sceneState.scene);
        if (dataUrl) {
          setCapturedImage(dataUrl);
          return;
        }
      } else if (engine === "cesium") {
        const dataUrl = await captureCesiumScreenshot(sceneState.cesiumViewer);
        if (dataUrl) {
          setCapturedImage(dataUrl);
          return;
        }
      } else if (engine === "mapbox") {
        const dataUrl = await captureMapboxScreenshot(sceneState.mapboxMap);
        if (dataUrl) {
          setCapturedImage(dataUrl);
          return;
        }
      }

      showToast("Failed to capture screenshot. Please try again.", "error");
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to capture screenshot.",
        "error"
      );
    }
  };

  const handleCaptureClick = () => {
    setCaptureModalOpen(true);
    setCapturedImage(null);
  };

  const handleCapture = async () => {
    await captureScreenshot();
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleUpload = async () => {
    if (!capturedImage || !projectId) return;

    setUploading(true);
    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Get presigned URL for thumbnail
      const { signedUrl, acl } = await getThumbnailUploadUrl({
        fileName: `project-thumbnails/${projectId}-${Date.now()}.png`,
        fileType: "image/png",
      });

      // Upload thumbnail to S3
      await uploadToSignedUrl(signedUrl, blob, {
        contentType: "image/png",
        acl,
      });

      // Extract thumbnail URL from signed URL (remove query parameters)
      const thumbnailUrl = signedUrl.split("?")[0];

      // Update project with thumbnail URL and size
      await updateProjectThumbnail(projectId, thumbnailUrl, blob.size);

      showToast("Thumbnail uploaded successfully", "success");

      // Close capture modal and refresh
      setCaptureModalOpen(false);
      setCapturedImage(null);
      onThumbnailUpdate?.();
      onUploadComplete?.(); // Close settings modal if provided
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to upload thumbnail",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCapture = () => {
    setCaptureModalOpen(false);
    setCapturedImage(null);
  };

  return {
    captureModalOpen,
    capturedImage,
    uploading,
    handleCaptureClick,
    handleCapture,
    handleRetake,
    handleUpload,
    handleCancelCapture,
  };
}

