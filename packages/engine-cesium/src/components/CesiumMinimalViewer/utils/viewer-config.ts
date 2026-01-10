import type { CesiumModule } from "../types";

/**
 * Default viewer configuration options
 */
export function getViewerOptions() {
  return {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    infoBox: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    shouldAnimate: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    // Disable default imagery provider so viewer starts with no basemap
    imageryProvider: false,
  };
}

interface ConfigureSceneOptions {
  enableAtmosphere?: boolean;
}

/**
 * Configure scene defaults (sun, moon, skybox, fog, background, atmosphere)
 */
export function configureScene(
  viewer: any,
  Cesium: CesiumModule,
  options: ConfigureSceneOptions = {}
) {
  // Check if viewer and scene are valid
  if (!viewer) {
    console.warn("[configureScene] Viewer is null or undefined");
    return;
  }

  // Check if viewer is destroyed
  if (viewer.isDestroyed && viewer.isDestroyed()) {
    console.warn("[configureScene] Viewer has been destroyed");
    return;
  }

  // Check if scene exists
  if (!viewer.scene) {
    console.warn("[configureScene] Viewer scene is not available");
    return;
  }

  const { enableAtmosphere = false } = options;

  // Double-check scene is still valid before accessing properties
  if (!viewer.scene || (viewer.isDestroyed && viewer.isDestroyed())) {
    return;
  }

  if (viewer.scene.globe) {
    viewer.scene.globe.enableLighting = false;
  }

  // Remove sun and moon for clean preview
  if (viewer.scene.sun) {
    viewer.scene.sun.show = false;
  }
  if (viewer.scene.moon) {
    viewer.scene.moon.show = false;
  }

  // Configure skybox based on options (skybox contains stars/sky)
  if (viewer.scene.skyBox) {
    viewer.scene.skyBox.show = enableAtmosphere;
  }

  // Configure atmosphere based on options
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = enableAtmosphere;

    if (enableAtmosphere) {
      // Enhance atmosphere appearance
      viewer.scene.skyAtmosphere.hueShift = 0.0;
      viewer.scene.skyAtmosphere.saturationShift = 0.0;
      viewer.scene.skyAtmosphere.brightnessShift = 0.0;
    }
  }

  // Disable fog for cleaner look
  if (viewer.scene.fog) {
    viewer.scene.fog.enabled = false;
  }

  // Set black background for clean preview (when atmosphere is disabled)
  if (!enableAtmosphere) {
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
  } else {
    // Use default color when atmosphere is enabled for better visual
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#000000");
  }
}
