"use client";

import React, { useEffect, useRef } from "react";
import { useSceneStore } from "@klorad/core";
import {
  isVectorIonType,
  loadTilesetWithTransform,
  loadVectorIonDataSource,
  reapplyTransformAfterReady,
  resolveIonType,
  waitForTilesetReady,
  positionCameraForTileset,
} from "../utils/tileset-operations";

interface TilesetWrapper {
  id: string;
  /** Set for 3D Tiles rows. */
  tileset?: any;
  /** Set for KML / GeoJSON / CZML rows. Kept in a separate field so
   *  fly-to and transform code doesn't accidentally treat a data
   *  source as a tileset. */
  dataSource?: any;
  dispose: () => void;
}

interface CesiumIonAssetsRendererProps {
  /**
   * Whether to automatically fly to tilesets when they're loaded.
   * Set to false for builder mode (user controls camera manually).
   * Set to true for minimal viewer/preview mode (auto-fly for better UX).
   * @default false
   */
  autoFlyToTileset?: boolean;
}

const CesiumIonAssetsRenderer: React.FC<CesiumIonAssetsRendererProps> = ({
  autoFlyToTileset = false,
}) => {
  const tilesetRefs = useRef<Map<string, TilesetWrapper>>(new Map());
  // Bumped every time the load effect re-runs. `initializeAsset`
  // captures the run token at start and discards its loaded data
  // source if the token has moved on — prevents a stale in-flight
  // load from attaching to the viewer after a newer effect run has
  // already swept and started a fresh load. Without this, toggling
  // clamp-to-ground fast enough leaves a ghost of the previous render.
  const runTokenRef = useRef(0);
  const cesiumIonAssets = useSceneStore((state) => state.cesiumIonAssets);
  const { cesiumViewer, cesiumInstance } = useSceneStore();
  const removeCesiumIonAsset = useSceneStore((state) => state.removeCesiumIonAsset);

  // Create a stable key that includes transform data to trigger re-renders
  const assetsKey = React.useMemo(() => {
    return cesiumIonAssets
      .map((asset) => {
        const transformKey = asset.transform?.matrix
          ? asset.transform.matrix.slice(12, 15).join(',') // Use translation part as key
          : 'no-transform';
        // `clampToGround` participates so toggling it in the
        // properties panel tears down + reloads the data source with
        // the new option (Cesium doesn't reactively update the
        // load-time flag once the source is added to the viewer).
        const clampKey = asset.clampToGround === false ? 'no-clamp' : 'clamp';
        return `${asset.id}-${asset.enabled}-${transformKey}-${clampKey}`;
      })
      .join('|');
  }, [cesiumIonAssets]);

  useEffect(() => {
    return () => {
      tilesetRefs.current.forEach((wrapper) => {
        wrapper.dispose();
      });
      tilesetRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!cesiumViewer || !cesiumInstance) {
      return;
    }

    // Dispose everything we're tracking, then also sweep any orphan
    // data sources still attached to the viewer with a `_kloradAssetId`
    // tag. Without the sweep, toggling a fast-changing option (e.g.
    // clamp-to-ground) can leave a ghost of the previous render: the
    // effect fires a fresh load before the previous `initializeAsset`
    // finished attaching, so its data source only lands on the viewer
    // AFTER our forEach-dispose — orphaning it forever.
    tilesetRefs.current.forEach((wrapper) => {
      wrapper.dispose();
    });
    tilesetRefs.current.clear();

    try {
      const collection = cesiumViewer.dataSources;
      if (collection) {
        const orphans: any[] = [];
        for (let i = 0; i < collection.length; i++) {
          const ds = collection.get(i);
          if (ds?._kloradAssetId != null) {
            orphans.push(ds);
          }
        }
        for (const ds of orphans) {
          collection.remove(ds, true);
        }
      }
    } catch {
      /* viewer torn down mid-teardown — nothing to do */
    }

    runTokenRef.current += 1;
    const runToken = runTokenRef.current;
    cesiumIonAssets.forEach((asset) => {
      if (asset.enabled) {
        initializeAsset(asset, runToken);
      }
    });
  }, [assetsKey, cesiumViewer, cesiumInstance]); // Use assetsKey instead of cesiumIonAssets

  const initializeAsset = async (asset: any, runToken: number) => {
    try {
      const originalToken = cesiumInstance.Ion.defaultAccessToken;
      cesiumInstance.Ion.defaultAccessToken = asset.apiKey;

      // Branch: vector-format Ion assets (KML / GeoJSON / CZML) go
      // through Cesium DataSources, not `Cesium3DTileset.fromIonAssetId`.
      // Without this, the tileset loader tries to `JSON.parse` raw
      // KML/XML and either throws or retries forever ("Tileset for
      // asset X not found after 20 retries").
      const ionType = resolveIonType(asset.type);
      if (isVectorIonType(ionType)) {
        const dataSource = await loadVectorIonDataSource(
          cesiumInstance,
          asset.assetId,
          ionType as "KML" | "GEOJSON" | "CZML",
          cesiumViewer,
          {
            // Default true — matches historic behaviour and covers the
            // common flat-KML case. Operator flips this off from the
            // properties panel when the source KML has real altitudes.
            clampToGround: asset.clampToGround ?? true,
          }
        );
        // If a newer run started while we were awaiting Ion, drop this
        // data source instead of attaching it — it would only be a
        // ghost of the previous option state.
        if (runToken !== runTokenRef.current) {
          try {
            dataSource.destroy?.();
          } catch {
            /* nothing to do */
          }
          cesiumInstance.Ion.defaultAccessToken = originalToken;
          return;
        }
        dataSource._kloradAssetId = asset.assetId;
        // Tag the runtime Ion type so the properties panel can detect
        // "this is a vector row" from the viewer directly, without
        // depending on `asset.type` being present on the store row
        // (older scenes persist without it).
        dataSource._kloradIonType = ionType;
        await cesiumViewer.dataSources.add(dataSource);

        const wrapper: TilesetWrapper = {
          id: asset.id,
          dataSource,
          dispose: () => {
            try {
              cesiumViewer?.dataSources?.remove(dataSource, true);
            } catch {
              /* teardown race — nothing to do */
            }
          },
        };
        tilesetRefs.current.set(asset.id, wrapper);

        if (autoFlyToTileset) {
          try {
            await cesiumViewer.flyTo(dataSource, { duration: 2.0 });
          } catch {
            /* ignore fly-to-during-teardown errors */
          }
        }
        cesiumInstance.Ion.defaultAccessToken = originalToken;
        return;
      }

      // Load tileset with transform (uses shared utility function)
      // This applies transform before adding to scene
      const tileset = await loadTilesetWithTransform(
        cesiumInstance,
        asset.assetId,
        undefined, // metadata not available here, transform already extracted in useAssetManager
        asset.transform,
        {
          viewer: cesiumViewer,
          log: true,
        }
      );

      if (!tileset) {
        throw new Error("Failed to create tileset - tileset is null/undefined");
      }

      tileset.assetId = parseInt(asset.assetId);

      cesiumViewer.scene.primitives.add(tileset);
      const wrapper: TilesetWrapper = {
        id: asset.id,
        tileset,
        dispose: () => {
          try {
            if (
              cesiumViewer &&
              cesiumViewer.scene &&
              cesiumViewer.scene.primitives
            ) {
              cesiumViewer.scene.primitives.remove(tileset);
            }
          } catch (_error) {
            // Ignore primitive removal errors
          }
        },
      };

      tilesetRefs.current.set(asset.id, wrapper);

      // Wait for tileset to be ready, then re-apply transform
      // (Cesium sometimes resets it after ready)
      waitForTilesetReady(tileset)
        .then(async () => {
          // Re-apply transform after ready (same logic as CesiumMinimalViewer)
          if (asset.transform) {
            reapplyTransformAfterReady(
              cesiumInstance,
              tileset,
              asset.transform,
              {
                viewer: cesiumViewer,
                log: false,
              }
            );

            // Only auto-fly to tileset if enabled (for minimal viewer/preview mode)
            // In builder mode, user controls camera manually
            if (autoFlyToTileset) {
              // Use positionCameraForTileset instead of flyTo(tileset)
              // This respects the transform position, not the original tileset location
              await positionCameraForTileset(
                cesiumViewer,
                cesiumInstance,
                asset.transform,
                {
                  offset: 1000,
                  duration: 2.0,
                  pitch: -45,
                }
              );
            }
          } else {
            // Only auto-fly if enabled (for minimal viewer/preview mode)
            if (autoFlyToTileset) {
              // Fallback to default flyTo if no transform
              try {
                cesiumViewer.flyTo(tileset, {
                  duration: 2.0,
                  offset: new cesiumInstance.HeadingPitchRange(0, -0.5, 1000),
                });
              } catch (_error) {
                // Ignore flyTo errors
              }
            }
          }
        })
        .catch((_error: any) => {
          console.error(
            "[CesiumIonAssetsRenderer] Error waiting for tileset ready:",
            _error
          );
        });

      cesiumInstance.Ion.defaultAccessToken = originalToken;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is404Error =
        errorMessage.includes("404") ||
        errorMessage.includes("Status Code: 404") ||
        errorMessage.includes("Not Found") ||
        (error?.statusCode === 404);

      console.error("[CesiumIonAssetsRenderer] Error initializing asset:", {
        assetId: asset.assetId,
        name: asset.name,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        is404Error,
      });

      // If asset doesn't exist (404), remove it from the scene store
      // This prevents old/invalid assets from cluttering the scene
      if (is404Error) {
        console.warn(
          `[CesiumIonAssetsRenderer] Asset ${asset.assetId} (${asset.name}) not found (404). Removing from scene.`
        );
        removeCesiumIonAsset(asset.id);
      }
    }
  };

  const enabledAssets = cesiumIonAssets.filter((asset) => asset.enabled);
  if (enabledAssets.length === 0) {
    return null;
  }

  return null;
};

export default CesiumIonAssetsRenderer;
