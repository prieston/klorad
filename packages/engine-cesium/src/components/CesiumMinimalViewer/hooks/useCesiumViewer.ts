import { useRef, useEffect, useState } from "react";
import { ensureCesiumBaseUrl } from "../../../utils/cesium-config";
import { configureScene, getViewerOptions } from "../utils/viewer-config";
import type { CesiumModule } from "../types";

interface UseCesiumViewerOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  cesiumApiKey?: string;
  enableAtmosphere?: boolean;
  onViewerReady?: (viewer: any) => void;
  onError?: (error: Error) => void;
}

interface UseCesiumViewerReturn {
  viewer: any | null;
  Cesium: CesiumModule | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to initialize and manage the Cesium viewer lifecycle
 */
export function useCesiumViewer({
  containerRef,
  cesiumApiKey,
  enableAtmosphere = false,
  onViewerReady,
  onError,
}: UseCesiumViewerOptions): UseCesiumViewerReturn {
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const isInitializing = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current || isInitializing.current) {
      return;
    }

    isInitializing.current = true;
    setIsLoading(true);

    const initializeCesium = async () => {
      try {
        if (!containerRef.current) {
          throw new Error("Container ref is null");
        }

        // Load Cesium
        const { ensureIonSDKLoaded } = await import("@klorad/ion-sdk");
        await ensureIonSDKLoaded();
        ensureCesiumBaseUrl();

        const Cesium = await import("cesium");
        cesiumRef.current = Cesium as any;

        // Set Ion token
        if (cesiumApiKey) {
          Cesium.Ion.defaultAccessToken = cesiumApiKey;
        }

        // Create viewer
        const viewer = new Cesium.Viewer(
          containerRef.current,
          getViewerOptions()
        );

        viewerRef.current = viewer;

        // Remove any default imagery layers as a safety net
        // (imageryProvider: false in viewer options should prevent this, but we ensure it's removed)
        try {
          if (viewer.imageryLayers && viewer.imageryLayers.length > 0) {
            viewer.imageryLayers.removeAll();
          }
        } catch (imageryErr) {
          // Silently ignore - this is non-critical
        }

        // Configure scene defaults (wrap in try-catch to prevent errors from breaking initialization)
        try {
          configureScene(viewer, Cesium as any, { enableAtmosphere });
        } catch (configErr) {
          console.warn(
            "[useCesiumViewer] Scene configuration error (non-critical):",
            configErr
          );
          // Continue with initialization even if scene config fails
        }

        // Notify viewer ready
        if (onViewerReady) {
          onViewerReady(viewer);
        }

        isInitializing.current = false;
        setIsLoading(false);
      } catch (err) {
        console.error("[useCesiumViewer] Initialization error:", err);
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        isInitializing.current = false;
        setIsLoading(false);
        if (onError) {
          onError(errorObj);
        }
      }
    };

    initializeCesium();

    // Cleanup
    return () => {
      if (viewerRef.current) {
        try {
          // Cleanup debug event listeners if they exist
          if ((viewerRef.current as any)._cesiumMinimalViewerDebugCleanup) {
            (viewerRef.current as any)._cesiumMinimalViewerDebugCleanup();
            delete (viewerRef.current as any)._cesiumMinimalViewerDebugCleanup;
          }

          // Cleanup viewer
          if (!viewerRef.current.isDestroyed()) {
            viewerRef.current.destroy();
          }
        } catch (err) {
          console.error("[useCesiumViewer] Cleanup error:", err);
        }
        viewerRef.current = null;
      }

      // Cleanup DOM
      if (containerRef.current) {
        const cesiumViewers =
          containerRef.current.querySelectorAll(".cesium-viewer");
        cesiumViewers.forEach((viewer) => {
          if (viewer.parentNode) {
            try {
              viewer.remove();
            } catch (err) {
              // Ignore
            }
          }
        });
      }
    };
  }, []);

  return {
    viewer: viewerRef.current,
    Cesium: cesiumRef.current,
    isLoading,
    error,
  };
}
