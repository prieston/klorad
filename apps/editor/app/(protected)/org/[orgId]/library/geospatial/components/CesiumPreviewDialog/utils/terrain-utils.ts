import React from "react";

/**
 * Show terrain by restoring or creating a terrain provider
 * @param viewer - Cesium viewer instance
 * @param originalTerrainProviderRef - Ref to store/retrieve original terrain provider
 * @returns Promise that resolves when terrain is shown
 */
export async function showTerrain(
  viewer: any,
  originalTerrainProviderRef: React.MutableRefObject<any>
): Promise<void> {
  if (!viewer || !viewer.scene) {
    return;
  }

  const Cesium = await import("cesium");

  // First check if the stored provider is actually a real terrain provider (not Ellipsoid)
  let terrainProviderToUse = null;

  if (originalTerrainProviderRef.current) {
    const storedIsEllipsoid =
      originalTerrainProviderRef.current instanceof
      Cesium.EllipsoidTerrainProvider;
    if (!storedIsEllipsoid) {
      // We have a stored non-Ellipsoid provider, use it
      terrainProviderToUse = originalTerrainProviderRef.current;
    }
  }

  // If we don't have a valid stored provider, load Cesium World Terrain
  if (!terrainProviderToUse) {
    terrainProviderToUse = await Cesium.createWorldTerrainAsync({
      requestWaterMask: true,
      requestVertexNormals: true,
    });
    originalTerrainProviderRef.current = terrainProviderToUse;
  }

  // Set the terrain provider
  viewer.terrainProvider = terrainProviderToUse;

  // Ensure globe is visible and enable depth testing against terrain
  if (viewer.scene.globe) {
    viewer.scene.globe.show = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;
  }

  // Request render to update the scene with terrain
  viewer.scene.requestRender();
}

/**
 * Hide terrain by using flat EllipsoidTerrainProvider
 * @param viewer - Cesium viewer instance
 * @param originalTerrainProviderRef - Ref to store current terrain provider before hiding
 */
export async function hideTerrain(
  viewer: any,
  originalTerrainProviderRef: React.MutableRefObject<any>
): Promise<void> {
  if (!viewer || !viewer.scene) {
    return;
  }

  const Cesium = await import("cesium");
  const currentProvider = viewer.terrainProvider;
  const currentIsEllipsoid =
    currentProvider instanceof Cesium.EllipsoidTerrainProvider;

  // Before hiding, store the current terrain provider if it's not Ellipsoid
  if (!currentIsEllipsoid) {
    originalTerrainProviderRef.current = currentProvider;
  }

  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  if (viewer.scene.globe) {
    viewer.scene.globe.depthTestAgainstTerrain = false;
  }

  // Request render to update the scene
  viewer.scene.requestRender();
}
