/**
 * Utility functions for rendering entities in Cesium
 */

/**
 * Determines if coordinates are geographic or local
 */
export function isGeographicCoordinates(
  x: number,
  y: number,
  z: number,
  coordinateSystem?: string
): boolean {
  return (
    coordinateSystem === "geographic" ||
    (x >= -180 && x <= 180 && y >= -90 && y <= 90 && Math.abs(z) < 50000) // Height should be reasonable for geographic coordinates
  );
}

/**
 * Converts local coordinates to geographic coordinates
 */
export function convertLocalToGeographic(
  x: number,
  y: number,
  z: number,
  referenceLat: number = 35.6586, // Default reference latitude (Tokyo)
  referenceLon: number = 139.7454 // Default reference longitude (Tokyo)
): { longitude: number; latitude: number; height: number } {
  const earthRadius = 6378137.0; // Earth's radius in meters

  // Convert local coordinates to geographic offsets
  const latOffset = (x / earthRadius) * (180 / Math.PI);
  const lonOffset =
    (z / (earthRadius * Math.cos((referenceLat * Math.PI) / 180))) *
    (180 / Math.PI);

  return {
    longitude: referenceLon + lonOffset,
    latitude: referenceLat + latOffset,
    height: z,
  };
}

/**
 * Checks if an object is a 3D model file (not tiles)
 */
export function isModelFile(obj: { url?: string; type?: string }): boolean {
  if (!obj.url || !obj.type) return false;

  const urlLower = obj.url.toLowerCase();
  const typeLower = obj.type.toLowerCase();

  return (
    typeLower.includes("gltf") ||
    typeLower.includes("glb") ||
    typeLower.includes("obj") ||
    typeLower.includes("fbx") ||
    typeLower.includes("dae") ||
    urlLower.includes(".gltf") ||
    urlLower.includes(".glb") ||
    urlLower.includes(".obj") ||
    urlLower.includes(".fbx") ||
    urlLower.includes(".dae")
  );
}

/**
 * Creates a model entity in Cesium
 * Note: Entity cleanup is handled by useCesiumEntities hook which removes
 * entities not in the current objects set. This function only adds/updates entities.
 */
export function createModelEntity(
  viewer: any,
  Cesium: any,
  obj: {
    id: string;
    name?: string;
    url?: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    interactable?: boolean;
  },
  longitude: number,
  latitude: number,
  height: number
): void {
  const [heading = 0, pitch = 0, roll = 0] = obj.rotation || [0, 0, 0];
  const [scaleX = 1, scaleY = 1, scaleZ = 1] = obj.scale || [1, 1, 1];
  const uniformScale = Math.max(scaleX, scaleY, scaleZ); // Use max for uniform scaling

  const entityPosition = Cesium.Cartesian3.fromDegrees(
    longitude,
    latitude,
    height
  );
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    entityPosition,
    new Cesium.HeadingPitchRoll(heading, pitch, roll),
    Cesium.Ellipsoid.WGS84
  );

  const entityId = `model-${obj.id}`;

  let entity = viewer.entities.getById(entityId);
  if (!entity) {
    // Remove any existing entity with same ID before adding (cleanup for audit compliance)
    const existingEntity = viewer.entities.getById(entityId);
    if (existingEntity) {
      viewer.entities.remove(existingEntity);
    }
    entity = viewer.entities.add({
      id: entityId,
      position: entityPosition,
      orientation,
      pickable: obj.interactable !== false, // Default to true if undefined
      model: {
        uri: obj.url,
        scale: uniformScale,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0.0,
          Number.MAX_VALUE
        ),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: obj.name || "Model",
        font: "12pt sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
      },
    });
  } else {
    // Update existing entity properties only if they actually changed
    // This prevents flickering when transform editor updates the store
    const now = Cesium.JulianDate.now();
    const currentPos = entity.position?.getValue?.(now);
    const needsPositionUpdate = !currentPos ||
      !Cesium.Cartesian3.equals(currentPos, entityPosition, Cesium.Math.EPSILON10);

    if (needsPositionUpdate) {
      entity.position = entityPosition;
    }

    const currentOrientation = entity.orientation?.getValue?.(now);
    const needsOrientationUpdate = !currentOrientation ||
      !Cesium.Quaternion.equals(currentOrientation, orientation, Cesium.Math.EPSILON10);

    if (needsOrientationUpdate) {
      entity.orientation = orientation;
    }

    if (entity.model) {
      // Only update model properties if they changed
      if (entity.model.uri !== obj.url) {
        entity.model.uri = obj.url;
      }
      const currentScale = (entity.model as any).scale?.getValue?.(now) ?? (entity.model as any).scale;
      if (currentScale !== uniformScale) {
        (entity.model as any).scale = uniformScale;
      }
      (entity.model as any).disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    // Update label text if name changed
    if (entity.label) {
      const currentLabelText = (entity.label as any).text?.getValue?.(now) ?? (entity.label as any).text;
      const newLabelText = obj.name || "Model";
      if (currentLabelText !== newLabelText) {
        (entity.label as any).text = newLabelText;
      }
    }

    // Update pickable property if interactable changed
    const newPickable = obj.interactable !== false; // Default to true if undefined
    if (entity.pickable !== newPickable) {
      entity.pickable = newPickable;
    }
    // Note: Cesium automatically requests render when entity properties change,
    // so we don't need to call requestRender() manually
  }
}

/**
 * Creates a point entity in Cesium
 * Note: Entity cleanup is handled by useCesiumEntities hook which removes
 * entities not in the current objects set. This function only adds/updates entities.
 */
export function createPointEntity(
  viewer: any,
  Cesium: any,
  obj: {
    id: string;
    name?: string;
    position: [number, number, number];
    interactable?: boolean;
  },
  longitude: number,
  latitude: number,
  height: number
): void {
  const entityId = `model-${obj.id}`;
  const entity = viewer.entities.getById(entityId);
  const pos = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

  if (!entity) {
    // Remove any existing entity with same ID before adding (cleanup for audit compliance)
    const existingEntity = viewer.entities.getById(entityId);
    if (existingEntity) {
      viewer.entities.remove(existingEntity);
    }
    viewer.entities.add({
      id: entityId,
      position: pos,
      pickable: obj.interactable !== false, // Default to true if undefined
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: obj.name || "Object",
        font: "12pt sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
      },
    });
  } else {
    // Only update position if it actually changed
    const now = Cesium.JulianDate.now();
    const currentPos = entity.position?.getValue?.(now);
    if (!currentPos || !Cesium.Cartesian3.equals(currentPos, pos, Cesium.Math.EPSILON10)) {
      entity.position = pos;
    }

    // Update label text if name changed
    if (entity.label) {
      const currentLabelText = (entity.label as any).text?.getValue?.(now) ?? (entity.label as any).text;
      const newLabelText = obj.name || "Object";
      if (currentLabelText !== newLabelText) {
        (entity.label as any).text = newLabelText;
      }
    }

    // Update pickable property if interactable changed
    const newPickable = obj.interactable !== false; // Default to true if undefined
    if (entity.pickable !== newPickable) {
      entity.pickable = newPickable;
    }
    // Note: Cesium automatically requests render when entity properties change
  }
}
