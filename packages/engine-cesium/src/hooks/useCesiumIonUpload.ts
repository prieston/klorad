import { useState } from "react";

export interface CesiumIonUploadOptions {
  dracoCompression?: boolean;
  ktx2Compression?: boolean;
  webpImages?: boolean;
  geometricCompression?: string;
  epsgCode?: string;
  makeDownloadable?: boolean;
  tilesetJson?: string;
  gaussianSplats?: boolean;
  // 3D Reconstruction options
  sourceType?: string;
  meshQuality?: string; // "Low" | "Medium" | "High"
  useGpsInfo?: boolean;
  outputs?: {
    cesium3DTiles?: boolean;
    las?: boolean;
    gaussianSplats?: boolean;
  };
}

export interface CesiumIonUploadData {
  file: File;
  name: string;
  description: string;
  sourceType: string;
  accessToken?: string; // Optional: can use integrationId instead
  integrationId?: string; // Optional: can use accessToken instead
  longitude?: number;
  latitude?: number;
  height?: number;
  options?: CesiumIonUploadOptions;
}

export interface CesiumIonAssetStatus {
  status: string;
  percentComplete?: number;
  error?: { message?: string };
  name?: string;
  description?: string;
  type?: string;
  bytes?: number;
}

/**
 * Hook for handling Cesium Ion file uploads
 * Pure Cesium Ion logic without app-specific API calls
 */
export const useCesiumIonUpload = () => {
  const [ionUploading, setIonUploading] = useState(false);
  const [ionUploadProgress, setIonUploadProgress] = useState(0);

  /**
   * Poll Cesium Ion asset status until tiling completes
   * Handles transient errors gracefully and only fails on explicit ERROR/FAILED status
   * Continues polling indefinitely until Cesium Ion reports COMPLETE or ERROR/FAILED
   * @param _fileSizeBytes Optional file size in bytes (kept for API compatibility, not used)
   */
  const pollAssetStatus = async (
    assetId: number,
    accessToken: string,
    onProgress?: (status: string, percentComplete: number) => void,
    _fileSizeBytes?: number
  ): Promise<CesiumIonAssetStatus> => {
    // Use longer polling interval to reduce API calls and avoid rate limits
    // Start with 10 seconds, increase to 20 seconds after initial delay
    const initialPollInterval = 10000; // 10 seconds
    const steadyPollInterval = 20000; // 20 seconds after initial period
    const initialDelay = 15000; // 15 second delay before first poll (give Ion time to process)
    const initialPeriodDuration = 60000; // Use 10s interval for first minute, then switch to 20s
    const maxConsecutiveErrors = 10; // Allow more consecutive errors since we're polling longer

    // Wait before starting to poll (give Cesium Ion time to process the upload)
    await new Promise((resolve) => setTimeout(resolve, initialDelay));

    let consecutiveErrors = 0;
    let attempt = 0;
    const startTime = Date.now();

    // Poll indefinitely until Cesium Ion reports COMPLETE or ERROR/FAILED
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      try {
        const response = await fetch(
          `https://api.cesium.com/v1/assets/${assetId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );

        // Handle HTTP errors - treat 404 and 5xx as transient, retry
        if (!response.ok) {
          // 404 might mean asset isn't ready yet, retry
          if (response.status === 404) {
            consecutiveErrors++;
            if (consecutiveErrors >= maxConsecutiveErrors) {
              throw new Error(
                `Asset not found after ${maxConsecutiveErrors} attempts. The asset may not exist or the ID may be incorrect.`
              );
            }
            // Wait and retry
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            continue;
          }

          // 5xx errors are server errors, retry
          if (response.status >= 500) {
            consecutiveErrors++;
            if (consecutiveErrors >= maxConsecutiveErrors) {
              throw new Error(
                `Server error (${response.status}) after ${maxConsecutiveErrors} attempts. Please try again later.`
              );
            }
            // Exponential backoff for server errors
            await new Promise((resolve) =>
              setTimeout(resolve, pollInterval * (consecutiveErrors + 1))
            );
            continue;
          }

          // Other errors (4xx except 404) are likely permanent
          throw new Error(`Failed to fetch asset status: ${response.status}`);
        }

        // Reset consecutive error counter on success
        consecutiveErrors = 0;

        const assetInfo: CesiumIonAssetStatus = await response.json();
        const status = assetInfo.status;
        const percentComplete = assetInfo.percentComplete || 0;

        if (onProgress) {
          onProgress(status, percentComplete);
        }

        if (status === "COMPLETE") {
          return assetInfo;
        }

        // Only fail on explicit ERROR/FAILED status from Cesium Ion
        if (status === "ERROR" || status === "FAILED") {
          const errorMessage = assetInfo.error?.message || "Tiling failed";
          throw new Error(errorMessage);
        }

        // Continue polling for other statuses (IN_PROGRESS, etc.)
        // Use shorter interval initially, then switch to longer interval
        const elapsed = Date.now() - startTime;
        const pollInterval =
          elapsed < initialPeriodDuration
            ? initialPollInterval
            : steadyPollInterval;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        // If it's an explicit error from Cesium Ion (ERROR/FAILED status), throw it
        if (error instanceof Error && error.message.includes("Tiling failed")) {
          throw error;
        }

        // For other errors, log but continue polling (unless we've exceeded max consecutive errors)
        const elapsed = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsed / 60000);
        console.warn(
          `Error polling asset status (attempt ${attempt}, ${elapsedMinutes}min elapsed):`,
          error
        );

        // If we've exceeded max consecutive errors, throw
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Too many consecutive errors (${consecutiveErrors}) while polling asset status. Last error: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Wait before retrying (use longer interval for retries)
        await new Promise((resolve) => setTimeout(resolve, steadyPollInterval));
      }
    }
  };

  /**
   * Map source type to Cesium Ion's expected format
   */
  const mapSourceType = (sourceType: string) => {
    let ionType = sourceType;
    let uploadSourceType: string | undefined = undefined;

    if (sourceType === "3DTILES") {
      ionType = "3DTILES";
      uploadSourceType = "3D_MODEL";
    } else if (sourceType === "3DTILES_ARCHIVE") {
      ionType = "3DTILES";
      uploadSourceType = undefined;
    } else if (sourceType === "GLTF") {
      ionType = sourceType;
      uploadSourceType = "3D_MODEL";
    } else if (sourceType === "3DTILES_BIM") {
      ionType = "3DTILES";
      uploadSourceType = "BIM_CAD"; // Changed from "3D_MODEL" to "BIM_CAD"
    } else if (sourceType === "3DTILES_PHOTOGRAMMETRY") {
      ionType = "3DTILES";
      uploadSourceType = "3D_CAPTURE";
    } else if (sourceType === "POINTCLOUD") {
      ionType = "3DTILES";
      uploadSourceType = "POINT_CLOUD";
    } else if (sourceType === "IMAGERY") {
      uploadSourceType = "RASTER_IMAGERY";
    } else if (sourceType === "TERRAIN") {
      uploadSourceType = "RASTER_TERRAIN";
    } else if (sourceType === "PHOTOS_3D_RECONSTRUCTION") {
      ionType = "3DTILES";
      uploadSourceType = "RASTER_IMAGERY";
    } else if (
      sourceType === "KML" ||
      sourceType === "GEOJSON" ||
      sourceType === "CZML"
    ) {
      // Vector formats hosted as-is (no tiling). Ion still requires
      // `options.sourceType` — matching the type is the pattern that
      // works (same as IMAGERY → sourceType: "IMAGERY"). Without it
      // Ion 409s with `options.sourceType must be a valid source type`.
      ionType = sourceType;
      uploadSourceType = sourceType;
    }

    return { ionType, uploadSourceType };
  };

  /**
   * Upload file to S3 using Cesium Ion's temporary credentials
   * Uses multipart upload for large files (>5MB) to avoid loading entire file into memory
   */
  const uploadToS3 = async (
    file: File,
    uploadLocation: any,
    onProgress?: (percent: number) => void
  ) => {
    const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for multipart upload

    const {
      S3Client,
      PutObjectCommand,
      CreateMultipartUploadCommand,
      UploadPartCommand,
      CompleteMultipartUploadCommand,
    } = await import("@aws-sdk/client-s3");

    const s3Client = new S3Client({
      region: "us-east-1",
      endpoint: uploadLocation.endpoint,
      credentials: {
        accessKeyId: uploadLocation.accessKey,
        secretAccessKey: uploadLocation.secretAccessKey,
        sessionToken: uploadLocation.sessionToken,
      },
    });

    const s3Key = `${uploadLocation.prefix}${file.name}`;

    // Use multipart upload for large files to avoid loading entire file into memory
    if (file.size > LARGE_FILE_THRESHOLD) {
      // Initiate multipart upload
      const createResponse = await s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: uploadLocation.bucket,
          Key: s3Key,
          ContentType: file.type || "application/octet-stream",
        })
      );

      const uploadId = createResponse.UploadId!;
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const parts: Array<{ ETag: string; PartNumber: number }> = [];

      // Upload parts in chunks without loading entire file
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);

        // Use file.slice() to read chunk without loading entire file
        const chunk = file.slice(start, end);
        const chunkBuffer = await chunk.arrayBuffer();

        const uploadResponse = await s3Client.send(
          new UploadPartCommand({
            Bucket: uploadLocation.bucket,
            Key: s3Key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: new Uint8Array(chunkBuffer),
          })
        );

        parts.push({
          ETag: uploadResponse.ETag!,
          PartNumber: partNumber,
        });

        // Update progress: 20-90% range (20% for asset creation, 90% for completion)
        if (onProgress) {
          const progress = Math.round((partNumber / totalParts) * 70) + 20;
          onProgress(progress);
        }
      }

      // Complete multipart upload
      await s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: uploadLocation.bucket,
          Key: s3Key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        })
      );

      if (onProgress) {
        onProgress(90);
      }
    } else {
      // Small files: use simple upload (but still avoid loading entire file if possible)
      const fileBuffer = await file.arrayBuffer();

      await s3Client.send(
        new PutObjectCommand({
          Bucket: uploadLocation.bucket,
          Key: s3Key,
          Body: new Uint8Array(fileBuffer),
          ContentType: file.type || "application/octet-stream",
        })
      );

      if (onProgress) {
        onProgress(90);
      }
    }
  };

  return {
    ionUploading,
    ionUploadProgress,
    setIonUploading,
    setIonUploadProgress,
    pollAssetStatus,
    mapSourceType,
    uploadToS3,
  };
};
