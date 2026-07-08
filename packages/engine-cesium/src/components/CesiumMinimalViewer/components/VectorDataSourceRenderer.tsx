import { useVectorDataSource } from "../hooks/useVectorDataSource";
import type { CesiumModule } from "../types";

interface VectorDataSourceRendererProps {
  viewer: any | null;
  Cesium: CesiumModule | null;
  cesiumAssetId: string;
  ionType: "KML" | "GEOJSON" | "CZML";
  /** Callback fires once the data source is loaded + added to the
   *  viewer. Named `onReady` to sit alongside `TilesetRenderer`'s
   *  `onTilesetReady` — screenshot/capture flows treat "something is
   *  loaded" as a proxy for "safe to capture". */
  onReady?: (dataSource: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Renders a KML / GeoJSON / CZML Cesium Ion asset as a data source,
 * paralleling `TilesetRenderer`'s 3D-Tiles code path. Vector features
 * are georeferenced by nature, so we don't need the transform,
 * globe-visibility, or terrain toggling that TilesetRenderer does.
 */
export function VectorDataSourceRenderer({
  viewer,
  Cesium,
  cesiumAssetId,
  ionType,
  onReady,
  onError,
}: VectorDataSourceRendererProps) {
  useVectorDataSource({
    viewer,
    Cesium,
    cesiumAssetId,
    ionType,
    onReady,
    onError,
  });
  return null;
}
