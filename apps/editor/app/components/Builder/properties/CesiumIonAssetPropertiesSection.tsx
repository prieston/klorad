import React from "react";
import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { SettingContainer, SettingLabel } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";

interface CesiumIonAssetPropertiesSectionProps {
  /** Cesium Ion asset id (the numeric string stored on the model /
   *  scene-store CesiumIonAsset row). Used to find the matching
   *  `CesiumIonAsset` in the store so we can flip fields on it. */
  cesiumAssetId?: string;
  /** Fallback matcher used when the selected model doesn't carry
   *  `cesiumAssetId` (older rows persisted before that field was
   *  populated). Same fallback the parent's fly-to handler uses. */
  selectedObjectName?: string;
}

const VECTOR_TYPES = new Set(["KML", "GEOJSON", "CZML"]);

/** Poll `viewer.dataSources` for a change token so the panel
 *  re-renders when a vector data source is added/removed. Cesium's
 *  collections aren't React-reactive, so we listen to their events
 *  and bump a counter. */
function useDataSourcesVersion(cesiumViewer: any): number {
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    const dataSources = cesiumViewer?.dataSources;
    if (!dataSources) return;
    const bump = () => setVersion((v) => v + 1);
    const removeAdded = dataSources.dataSourceAdded?.addEventListener?.(bump);
    const removeRemoved =
      dataSources.dataSourceRemoved?.addEventListener?.(bump);
    // Kick once in case a data source was already present when we
    // mounted — the events won't fire retroactively.
    bump();
    return () => {
      try {
        removeAdded?.();
        removeRemoved?.();
      } catch {
        /* teardown race */
      }
    };
  }, [cesiumViewer]);
  return version;
}

/**
 * Right-panel section for properties that only apply to Cesium Ion
 * assets. Today: the "Clamp to ground" toggle for KML / GeoJSON.
 *
 * Detects the vector type at runtime from `viewer.dataSources` — we
 * tag each loaded data source with `_kloradIonType`, so the toggle
 * surfaces for any KML/GeoJSON currently rendered, even when the
 * persisted scene doc predates the `CesiumIonAsset.type` field.
 */
export const CesiumIonAssetPropertiesSection: React.FC<
  CesiumIonAssetPropertiesSectionProps
> = ({ cesiumAssetId, selectedObjectName }) => {
  const cesiumIonAssets = useSceneStore((s) => s.cesiumIonAssets);
  const updateCesiumIonAsset = useSceneStore((s) => s.updateCesiumIonAsset);
  const cesiumViewer = useSceneStore((s) => s.cesiumViewer);
  const dataSourcesVersion = useDataSourcesVersion(cesiumViewer);

  const asset = React.useMemo(() => {
    if (cesiumAssetId) {
      const byId = cesiumIonAssets.find(
        (a) => String(a.assetId) === String(cesiumAssetId)
      );
      if (byId) return byId;
    }
    if (selectedObjectName) {
      return cesiumIonAssets.find((a) => a.name === selectedObjectName);
    }
    return undefined;
  }, [cesiumIonAssets, cesiumAssetId, selectedObjectName]);

  // Once we know the asset, use ITS assetId for the runtime scan —
  // even when the parent didn't pass `cesiumAssetId`, we can still
  // find the matching data source via the asset row's own id.
  const effectiveAssetId = asset?.assetId ?? cesiumAssetId;

  // Runtime Ion-type resolution — walk `viewer.dataSources` for a
  // match on our tagged asset id, then infer the type from either
  // the tag we stamped at load time (fresh loads) or the data
  // source's constructor name (works even for data sources loaded
  // by a previous build that didn't stamp the tag). Falls back to
  // `asset.type` on the persisted store row if no data source is
  // present yet.
  const runtimeIonType = React.useMemo<string | undefined>(() => {
    if (!effectiveAssetId || !cesiumViewer?.dataSources) return undefined;
    void dataSourcesVersion; // recompute when collection changes
    const collection = cesiumViewer.dataSources;
    for (let i = 0; i < collection.length; i++) {
      const ds = collection.get(i);
      if (String(ds?._kloradAssetId) !== String(effectiveAssetId)) continue;

      const tagged = ds?._kloradIonType;
      if (typeof tagged === "string") return tagged.toUpperCase();

      const ctor = ds?.constructor?.name;
      if (typeof ctor === "string") {
        if (ctor.startsWith("Kml")) return "KML";
        if (ctor.startsWith("GeoJson")) return "GEOJSON";
        if (ctor.startsWith("Czml")) return "CZML";
      }
      // Data source is here but unrecognised — safest to treat it as
      // KML so the operator still gets the toggle; KML is the common
      // case that motivated this fix.
      return "KML";
    }
    return undefined;
  }, [cesiumViewer, effectiveAssetId, dataSourcesVersion]);

  const ionType =
    runtimeIonType || (asset?.type ? asset.type.toUpperCase() : undefined);

  if (!asset || !ionType) return null;
  if (!VECTOR_TYPES.has(ionType)) return null;

  // CZML sets altitude modes per-entity in the source packet, so
  // the load-time clamp option is a no-op. Rendering the switch would
  // just mislead the operator.
  if (ionType === "CZML") return null;

  const clampToGround = asset.clampToGround !== false;

  const handleToggle = (next: boolean) => {
    updateCesiumIonAsset(asset.id, { clampToGround: next });
  };

  return (
    <SettingContainer>
      <SettingLabel>{ionType} Options</SettingLabel>
      <Box
        sx={(theme) => ({
          borderRadius: "8px",
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        })}
      >
        <FormControlLabel
          control={
            <Switch
              id={`clamp-to-ground-${asset.id}`}
              name={`clamp-to-ground-${asset.id}`}
              checked={clampToGround}
              onChange={(e) => handleToggle(e.target.checked)}
              sx={(theme) => ({
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: theme.palette.primary.main,
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: theme.palette.primary.main,
                },
              })}
            />
          }
          label="Clamp to ground"
          sx={(theme) => ({
            margin: 0,
            padding: "8.5px 14px",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            "& .MuiFormControlLabel-label": {
              fontSize: "0.75rem",
              fontWeight: 400,
              color: theme.palette.text.secondary,
              flex: 1,
            },
          })}
          labelPlacement="start"
        />
      </Box>
      <Typography
        variant="caption"
        sx={(theme) => ({
          display: "block",
          mt: 1,
          px: 0.5,
          color: theme.palette.text.disabled,
          fontSize: "0.7rem",
          lineHeight: 1.4,
        })}
      >
        Drapes features onto the terrain surface. Turn off if the {ionType}{" "}
        already has real altitudes (e.g. flight paths) and you want them
        preserved.
      </Typography>
    </SettingContainer>
  );
};

export default CesiumIonAssetPropertiesSection;
