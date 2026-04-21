import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import type { CesiumIonAsset } from "./types";

const logger = createLogger("SceneStore");

export function createCesiumActions(set: any, get: any) {
  return {
    setCesiumViewer: (viewer: any) => set({ cesiumViewer: viewer }),
    setCesiumInstance: (instance: any) => set({ cesiumInstance: instance }),
    setBasemapType: (
      type: "cesium" | "google" | "google-photorealistic" | "bing" | "none"
    ) => set({ basemapType: type }),
    setCesiumLightingEnabled: (enabled: boolean) =>
      set({ cesiumLightingEnabled: enabled }),
    setCesiumShadowsEnabled: (enabled: boolean) =>
      set({ cesiumShadowsEnabled: enabled }),
    setCesiumCurrentTime: (time: string | null) =>
      set({ cesiumCurrentTime: time }),
    setSelectedCesiumFeature: (feature: any) =>
      set({
        selectedCesiumFeature: feature,
        ...(feature ? { selectedMapboxBuilding: null } : {}),
      }),
    setTilesRenderer: (renderer: any) => set({ tilesRenderer: renderer }),

    addGoogleTiles: (apiKey: string) =>
      set((state: any) => ({
        objects: [
          ...state.objects,
          {
            id: uuidv4(),
            name: "Google Photorealistic Tiles",
            type: "tiles",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            apiKey,
            component: "TilesRenderer",
          },
        ],
      })),

    addCesiumIonTiles: () =>
      set((state: any) => ({
        objects: [
          ...state.objects,
          {
            id: uuidv4(),
            name: "Cesium Ion Tiles",
            url: "https://assets.ion.cesium.com/1/",
            type: "tiles",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            assetId: "2275207",
          },
        ],
      })),

    addCesiumIonAsset: (asset: Omit<CesiumIonAsset, "id">) => {
      return set((state: any) => ({
        cesiumIonAssets: [...state.cesiumIonAssets, { ...asset, id: uuidv4() }],
      }));
    },

    removeCesiumIonAsset: (id: string) =>
      set((state: any) => ({
        cesiumIonAssets: state.cesiumIonAssets.filter(
          (asset: CesiumIonAsset) => asset.id !== id
        ),
      })),

    updateCesiumIonAsset: (id: string, updates: Partial<CesiumIonAsset>) =>
      set((state: any) => ({
        cesiumIonAssets: state.cesiumIonAssets.map((asset: CesiumIonAsset) =>
          asset.id === id ? { ...asset, ...updates } : asset
        ),
      })),

    toggleCesiumIonAsset: (id: string) =>
      set((state: any) => ({
        cesiumIonAssets: state.cesiumIonAssets.map((asset: CesiumIonAsset) =>
          asset.id === id ? { ...asset, enabled: !asset.enabled } : asset
        ),
      })),

    setCesiumIonAssets: (assets: CesiumIonAsset[]) =>
      set({ cesiumIonAssets: assets }),

    flyToCesiumIonAsset: (assetId: string) => {
      const state = get();
      const asset = state.cesiumIonAssets.find(
        (a: CesiumIonAsset) => a.id === assetId
      );
      const cesiumViewer = state.cesiumViewer;
      const cesiumInstance = state.cesiumInstance;

      if (!asset || !cesiumViewer || !cesiumInstance) {
        logger.warn(
          "Asset, Cesium viewer, or Cesium instance not available for fly-to"
        );
        return;
      }

      // Helper function to find tileset by assetId
      const findTilesetByAssetId = (): any => {
        const primitives = (cesiumViewer as any).scene.primitives;
        const expectedAssetId = parseInt((asset as any).assetId);

        for (let i = 0; i < primitives.length; i++) {
          const primitive = primitives.get(i);
          const primitiveAssetId = (primitive as any)?.assetId;
          if (primitive && primitiveAssetId === expectedAssetId) {
            return primitive;
          }
        }
        return null;
      };

      // Try to find tileset immediately
      let targetTileset: any = findTilesetByAssetId();

      // If not found and asset is enabled, wait for it to load (retry mechanism)
      // This prevents wrong fly-to when clicking too early
      if (!targetTileset && asset.enabled) {
        const maxRetries = 20; // 20 retries = 2 seconds total (100ms * 20)
        const retryDelay = 100; // ms
        let retries = 0;

        const retryFindTileset = () => {
          targetTileset = findTilesetByAssetId();
          retries++;

          if (targetTileset) {
            // Found it! Continue with fly-to
            performFlyTo();
          } else if (retries < maxRetries) {
            // Not found yet, retry
            setTimeout(retryFindTileset, retryDelay);
          } else {
            // Timeout - tileset didn't load after retries
            logger.warn(
              `[CesiumIon] Asset is still loading. Tileset for asset ${(asset as any).name} (${(asset as any).assetId}) not found after ${maxRetries} retries. Please wait and try again.`
            );
            // No fallback action - just log warning
          }
        };

        // Start retry mechanism
        setTimeout(retryFindTileset, retryDelay);
        return; // Exit early, will continue in retry callback
      }

      // If tileset found immediately, proceed with fly-to
      if (targetTileset) {
        performFlyTo();
      } else {
        // Asset disabled or not found - log appropriate warning
        if (!asset.enabled) {
          logger.warn(
            `[CesiumIon] Asset is not enabled/loaded in the scene. Cannot fly to disabled asset: ${(asset as any).name} (${(asset as any).assetId})`
          );
        } else {
          logger.warn(
            `[CesiumIon] Tileset not found for asset: ${(asset as any).name} (${(asset as any).assetId}). Asset may not be loaded yet.`
          );
        }
        // No fallback action - just log warning
      }

      // Helper function to perform the actual fly-to
      function performFlyTo() {
        if (!targetTileset) {
          logger.warn(
            `[CesiumIon] Cannot fly to asset: tileset not found for ${(asset as any).name} (${(asset as any).assetId})`
          );
          return;
        }

        try {
          // Function to fly to the tileset - use flyTo for smooth animation
          const flyToTileset = () => {
            try {
              // Request a render to ensure bounding sphere is updated
              (cesiumViewer as any).scene.requestRender();

              const pitch = -0.5; // ~-28.6 degrees (looking down slightly)
              const offset = new (cesiumInstance as any).HeadingPitchRange(
                0,
                pitch,
                0
              );

              // Use flyTo for smooth animation - better UX than instant zoomTo
              // flyTo respects modelMatrix and provides a smooth camera transition
              (cesiumViewer as any).flyTo(targetTileset, {
                duration: 2.0, // 2 second animation
                offset: offset,
              });
            } catch (error) {
              logger.error("Error flying to asset", error);
              // Fallback: try zoomTo if flyTo fails
              try {
                const pitch = -0.5;
                const offset = new (cesiumInstance as any).HeadingPitchRange(
                  0,
                  pitch,
                  0
                );
                (cesiumViewer as any).zoomTo(targetTileset, offset);
              } catch (zoomError) {
                logger.error("Error zooming to asset (fallback)", zoomError);
              }
            }
          };

          // For transformed tilesets, wait longer to ensure bounding sphere is recalculated
          // CesiumMinimalViewer waits 800ms for transformed models
          if (asset.transform?.matrix) {
            // Request multiple renders to force bounding sphere update
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                if (
                  (cesiumViewer as any) &&
                  !(cesiumViewer as any).isDestroyed()
                ) {
                  (cesiumViewer as any).scene.requestRender();
                }
              }, i * 50);
            }
            // Wait longer for transformed tilesets (like CesiumMinimalViewer does - 800ms)
            setTimeout(() => {
              flyToTileset();
            }, 800);
          } else {
            flyToTileset();
          }
        } catch (error) {
          logger.error("Error flying to asset", error);
        }
      }
    },
  };
}
