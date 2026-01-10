import React from "react";

/**
 * Clean up Cesium viewer DOM elements from container
 * @param containerRef - Ref to the container element
 */
export function cleanupViewerDOM(containerRef: React.RefObject<HTMLDivElement>): void {
  if (!containerRef.current) {
    return;
  }

  // Remove Cesium viewers
  const cesiumViewers = containerRef.current.querySelectorAll(".cesium-viewer");
  cesiumViewers.forEach((viewer) => {
    if (viewer.parentNode) {
      try {
        viewer.remove();
      } catch (err) {
        // Ignore errors if node was already removed
      }
    }
  });

  // Remove canvases
  const canvases = containerRef.current.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    if (canvas.parentNode) {
      try {
        canvas.remove();
      } catch (err) {
        // Ignore errors if node was already removed
      }
    }
  });

  // Remove Cesium widgets
  const cesiumWidgets = containerRef.current.querySelectorAll(".cesium-widget");
  cesiumWidgets.forEach((widget) => {
    if (widget.parentNode) {
      try {
        widget.remove();
      } catch (err) {
        // Ignore errors if node was already removed
      }
    }
  });
}

/**
 * Destroy Cesium viewer instance
 * @param viewerRef - Ref to the viewer instance
 */
export function destroyViewer(viewerRef: React.MutableRefObject<any>): void {
  if (viewerRef.current) {
    try {
      if (!viewerRef.current.isDestroyed || !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
    } catch (err) {
      // Ignore cleanup errors
    }
    viewerRef.current = null;
  }
}
