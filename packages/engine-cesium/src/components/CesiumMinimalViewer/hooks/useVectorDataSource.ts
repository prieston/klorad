import { useEffect, useRef, useState } from "react";
import {
  findExistingVectorDataSource,
  loadVectorIonDataSource,
} from "../../../utils/tileset-operations";
import type { CesiumModule } from "../types";

interface UseVectorDataSourceOptions {
  viewer: any | null;
  Cesium: CesiumModule | null;
  cesiumAssetId: string;
  ionType: "KML" | "GEOJSON" | "CZML";
  onReady?: (dataSource: any) => void;
  onError?: (error: Error) => void;
}

interface UseVectorDataSourceReturn {
  dataSource: any | null;
  isReady: boolean;
  error: Error | null;
}

/**
 * Load a KML / GeoJSON / CZML Ion asset as a Cesium `DataSource`,
 * attach it to `viewer.dataSources`, and clean up on unmount.
 *
 * Deliberately minimal — vector formats are georeferenced by nature,
 * so we skip the transform/atmosphere/globe-visibility gymnastics
 * that `useTileset` does. Frame the camera on the data source once
 * it's loaded and let it be.
 */
export function useVectorDataSource({
  viewer,
  Cesium,
  cesiumAssetId,
  ionType,
  onReady,
  onError,
}: UseVectorDataSourceOptions): UseVectorDataSourceReturn {
  const dataSourceRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isLoadingRef = useRef(false);

  // Keep the latest callback references in refs so the load effect
  // doesn't re-run every time the parent re-renders with fresh inline
  // functions. Following the pattern `useTileset` established — its
  // effect intentionally excludes `onTilesetReady`/`onError` from
  // deps for the same reason. Without this, every parent render
  // teared down + reloaded the data source, which manifested as the
  // KML preview flashing on/off during any state change upstream.
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  useEffect(() => {
    if (!viewer || !Cesium || !cesiumAssetId) return;
    if (isLoadingRef.current) return;

    // Reuse an existing data source for this asset id if the effect
    // fires twice under React strict mode.
    const existing = findExistingVectorDataSource(viewer, cesiumAssetId);
    if (existing) {
      dataSourceRef.current = existing;
      setIsReady(true);
      onReadyRef.current?.(existing);
      return;
    }

    isLoadingRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const dataSource = await loadVectorIonDataSource(
          Cesium,
          cesiumAssetId,
          ionType,
          viewer
        );
        if (cancelled) return;

        dataSource._kloradAssetId = cesiumAssetId;
        // Tag the Ion type at runtime so panels can detect it
        // without depending on the (optional, possibly-un-hydrated)
        // `asset.type` field on the scene store row.
        dataSource._kloradIonType = ionType;

        // Viewer could have been torn down while we awaited Ion.
        if (
          !viewer ||
          !viewer.dataSources ||
          (viewer.isDestroyed && viewer.isDestroyed())
        ) {
          return;
        }
        await viewer.dataSources.add(dataSource);

        // Frame the camera on the loaded features. `flyTo` handles the
        // bounding-sphere maths for us. Swallow errors — Cesium throws
        // if the viewer is destroyed mid-flight.
        try {
          await viewer.flyTo(dataSource, { duration: 0 });
        } catch {
          /* ignore camera-during-teardown errors */
        }

        dataSourceRef.current = dataSource;
        setIsReady(true);
        onReadyRef.current?.(dataSource);
      } catch (err) {
        if (cancelled) return;
        const errorObj =
          err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsReady(false);
        onErrorRef.current?.(errorObj);
      } finally {
        isLoadingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      isLoadingRef.current = false;

      const currentDs = dataSourceRef.current;
      if (currentDs && viewer && !(viewer.isDestroyed && viewer.isDestroyed())) {
        try {
          viewer.dataSources?.remove(currentDs, true);
        } catch {
          /* teardown races — nothing to do */
        }
      }
      dataSourceRef.current = null;
    };
    // Callbacks intentionally excluded — see the ref block above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, Cesium, cesiumAssetId, ionType]);

  return {
    dataSource: dataSourceRef.current,
    isReady,
    error,
  };
}
