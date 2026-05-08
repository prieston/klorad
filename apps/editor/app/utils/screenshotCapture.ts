"use client";

/**
 * Screenshot capture utilities for Three.js and Cesium scenes
 */

/**
 * Captures a screenshot from a Three.js canvas
 */
export function captureThreeJSScreenshot(scene: any): string | null {
  const canvas: HTMLCanvasElement =
    (scene?.renderer?.domElement as HTMLCanvasElement) ||
    (document.querySelector("canvas") as HTMLCanvasElement);

  if (canvas) {
    // Ensure preserveDrawingBuffer is enabled (should be set in Canvas component)
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl;
  }

  return null;
}

/**
 * Captures a screenshot from a Cesium viewer
 * Uses postRender callback to read framebuffer before it's cleared
 */
export async function captureCesiumScreenshot(
  viewer: any
): Promise<string | null> {
  if (!viewer) {
    throw new Error("Cesium viewer not ready");
  }

  // Check if viewer is destroyed
  if (viewer.isDestroyed && viewer.isDestroyed()) {
    throw new Error("Cesium viewer has been destroyed");
  }

  // Check if scene exists before accessing it
  if (!viewer.scene) {
    throw new Error("Cesium viewer scene not available");
  }

  const scene = viewer.scene;
  const canvas = scene.canvas;
  const context = scene.context;

  if (!scene || !canvas || !context) {
    throw new Error("Scene not available");
  }

  const gl = context._gl;

  // Read pixels during postRender callback to capture before buffer is cleared
  return new Promise<string>((resolve, reject) => {
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);

    const renderListener = () => {
      try {
        // Check if viewer/scene is still valid before proceeding
        if (!viewer || !viewer.scene || !scene || !canvas || !context) {
          if (scene && scene.postRender) {
            try {
              scene.postRender.removeEventListener(renderListener);
            } catch (err) {
              // Ignore errors if scene was destroyed
            }
          }
          reject(new Error("Viewer or scene was destroyed during capture"));
          return;
        }

        // Check if viewer is destroyed
        if (viewer.isDestroyed && viewer.isDestroyed()) {
          if (scene && scene.postRender) {
            try {
              scene.postRender.removeEventListener(renderListener);
            } catch (err) {
              // Ignore errors if scene was destroyed
            }
          }
          reject(new Error("Viewer was destroyed during capture"));
          return;
        }

        // Remove listener immediately to avoid multiple calls
        scene.postRender.removeEventListener(renderListener);

        // Read pixels synchronously during the render callback
        // This is critical - must read before the buffer is cleared
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Check if we got valid pixel data
        let hasData = false;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 5 || pixels[i + 1] > 5 || pixels[i + 2] > 5) {
            hasData = true;
            break;
          }
        }

        if (!hasData) {
          reject(new Error("Framebuffer appears to be empty"));
          return;
        }

        // Create a temporary canvas and draw the pixels
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not create 2D context"));
          return;
        }

        const imageData = ctx.createImageData(width, height);
        // Flip vertically (WebGL has origin at bottom-left, canvas at top-left)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIndex = ((height - 1 - y) * width + x) * 4;
            const dstIndex = (y * width + x) * 4;
            imageData.data[dstIndex] = pixels[srcIndex]; // R
            imageData.data[dstIndex + 1] = pixels[srcIndex + 1]; // G
            imageData.data[dstIndex + 2] = pixels[srcIndex + 2]; // B
            imageData.data[dstIndex + 3] = pixels[srcIndex + 3]; // A
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = tempCanvas.toDataURL("image/png");

        if (dataUrl && dataUrl !== "data:,") {
          resolve(dataUrl);
        } else {
          reject(new Error("Failed to create data URL"));
        }
      } catch (error) {
        // Only try to remove listener if scene still exists
        if (scene && scene.postRender) {
          try {
        scene.postRender.removeEventListener(renderListener);
          } catch (err) {
            // Ignore errors if scene was destroyed
          }
        }
        reject(error);
      }
    };

    // Request a render and wait for postRender callback
    scene.postRender.addEventListener(renderListener);
    scene.requestRender();

    // Timeout fallback
    setTimeout(() => {
      // Only try to remove listener if scene still exists
      if (scene && scene.postRender) {
        try {
      scene.postRender.removeEventListener(renderListener);
        } catch (err) {
          // Ignore errors if scene was destroyed
        }
      }
      reject(new Error("Screenshot capture timed out"));
    }, 5000);
  });
}

/**
 * Mapbox map canvas capture (after map is idle).
 */
export async function captureMapboxScreenshot(map: any): Promise<string | null> {
  if (!map?.getCanvas) {
    throw new Error("Mapbox map not ready");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) reject(new Error("Mapbox screenshot timed out"));
    }, 8000);
    const finish = () => {
      try {
        const canvas = map.getCanvas() as HTMLCanvasElement;
        settled = true;
        clearTimeout(to);
        resolve(canvas?.toDataURL("image/png") ?? null);
      } catch (e) {
        settled = true;
        clearTimeout(to);
        reject(e);
      }
    };
    const run = () => {
      map.once("idle", finish);
      map.triggerRepaint?.();
    };
    if (map.isStyleLoaded?.()) run();
    else map.once("load", run);
  });
}

