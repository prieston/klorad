import React from "react";
import { captureCesiumScreenshot } from "@/app/utils/screenshotCapture";

interface UseCaptureFlowProps {
  viewerRef: React.MutableRefObject<any>;
  isCapturingRef: React.MutableRefObject<boolean>;
  isUploadingRef: React.MutableRefObject<boolean>;
  capturing: boolean;
  uploading: boolean;
  setCapturing: (capturing: boolean) => void;
  setUploading: (uploading: boolean) => void;
  setError: (error: string | null) => void;
  onCapture: (screenshot: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Hook to handle capture and upload flow
 */
export function useCaptureFlow({
  viewerRef,
  isCapturingRef,
  isUploadingRef,
  capturing: _capturing,
  uploading: _uploading,
  setCapturing,
  setUploading,
  setError,
  onCapture,
  onClose,
}: UseCaptureFlowProps) {
  const handleCapture = async () => {
    // Double-check viewer is still valid before capturing
    if (!viewerRef.current) {
      setError("Viewer not ready. Please wait for the model to load.");
      return;
    }

    // Check if viewer is destroyed
    if (viewerRef.current.isDestroyed && viewerRef.current.isDestroyed()) {
      setError("Viewer has been closed. Please reopen the dialog.");
      return;
    }

    // Check if scene is available
    if (!viewerRef.current.scene) {
      setError("Scene not ready. Please wait for the model to load.");
      return;
    }

    // Set capturing flag to prevent cleanup
    isCapturingRef.current = true;
    setCapturing(true);

    try {
      const screenshot = await captureCesiumScreenshot(viewerRef.current);
      if (screenshot) {
        // Screenshot captured successfully, now upload it
        setCapturing(false);
        isCapturingRef.current = false;
        setUploading(true);
        isUploadingRef.current = true;

        try {
          // Await the upload to complete before closing modal
          await onCapture(screenshot);

          // Upload completed successfully
          setUploading(false);
          isUploadingRef.current = false;

          onClose();
        } catch (uploadErr) {
          // Upload failed, but screenshot was captured
          console.error("Error uploading screenshot:", uploadErr);
          setError(
            uploadErr instanceof Error
              ? uploadErr.message
              : "Failed to upload screenshot"
          );
          setUploading(false);
          isUploadingRef.current = false;
          // Don't close modal on upload error - let user retry
        }
      } else {
        throw new Error("Failed to capture screenshot");
      }
    } catch (err) {
      console.error("Error capturing screenshot:", err);
      setError(
        err instanceof Error ? err.message : "Failed to capture screenshot"
      );
      setCapturing(false);
      setUploading(false);
      isCapturingRef.current = false;
      isUploadingRef.current = false;
    }
  };

  const handleClose = () => {
    // Prevent closing while capture or upload is in progress
    if (isCapturingRef.current || isUploadingRef.current) {
      return;
    }
    onClose();
  };

  return { handleCapture, handleClose };
}
