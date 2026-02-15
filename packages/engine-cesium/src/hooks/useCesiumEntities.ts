/**
 * Hook for rendering and managing entities in Cesium viewer
 */

import { useEffect, useRef } from "react";
import { useWorldStore, useSceneStore } from "@klorad/core";
import {
  isGeographicCoordinates,
  convertLocalToGeographic,
  isModelFile,
  createModelEntity,
  createPointEntity,
} from "../utils/entity-rendering";

export function useCesiumEntities(
  viewer: any,
  cesium: any,
  isLoading: boolean
) {
  const world = useWorldStore((s) => s.activeWorld);
  const objects = useSceneStore((s) => s.objects);

  // Track previous objects to detect actual changes (not just reference changes)
  const prevObjectsRef = useRef<
    Map<
      string,
      {
        position: number[];
        rotation?: number[];
        scale?: number[];
        url?: string;
        name?: string;
        interactable?: boolean;
      }
    >
  >(new Map());

  useEffect(() => {
    if (!viewer || !cesium || isLoading) return;

    try {
      // Track model entity ids we want to keep this render
      const keepModelEntityIds = new Set<string>();
      const currentObjects = new Map<
        string,
        {
          position: number[];
          rotation?: number[];
          scale?: number[];
          url?: string;
          name?: string;
          interactable?: boolean;
        }
      >();

      if (objects.length > 0) {
        // Render actual objects from world data
        objects.forEach((obj) => {
          // Skip Cesium Ion assets - they're rendered by CesiumIonAssetsRenderer
          if (
            obj.type === "cesium-ion-tileset" ||
            obj.type === "cesiumIonAsset"
          ) {
            return;
          }

          const [x = 0, y = 0, z = 0] = obj.position || [];

          // Skip objects without positions
          if (!obj.position || obj.position.length !== 3) {
            return;
          }

          // Check if this object actually changed
          const prevObj = prevObjectsRef.current.get(obj.id);
          const objData = {
            position: obj.position,
            rotation: obj.rotation,
            scale: obj.scale,
            url: obj.url,
            name: obj.name,
            interactable: obj.interactable,
          };

          // Compare values precisely to avoid false positives from floating point precision
          const arraysEqual = (
            a?: number[],
            b?: number[],
            epsilon = 1e-10
          ): boolean => {
            if (!a && !b) return true;
            if (!a || !b) return false;
            if (a.length !== b.length) return false;
            return !a.some((v, i) => Math.abs(v - b[i]) > epsilon);
          };

          const hasChanged =
            !prevObj ||
            !arraysEqual(prevObj.position, objData.position) ||
            !arraysEqual(prevObj.rotation, objData.rotation) ||
            !arraysEqual(prevObj.scale, objData.scale) ||
            prevObj.url !== objData.url ||
            prevObj.name !== objData.name ||
            prevObj.interactable !== objData.interactable;

          currentObjects.set(obj.id, objData);

          // Determine if these are geographic coordinates (Cesium) or local coordinates (Three.js)
          const isGeographic = isGeographicCoordinates(
            x,
            y,
            z,
            obj.coordinateSystem
          );

          let longitude: number, latitude: number, height: number;

          if (isGeographic) {
            // These are already geographic coordinates (from Cesium placement)
            longitude = x;
            latitude = y;
            height = z;
          } else {
            // These are local coordinates (from Three.js placement) - convert to geographic
            const converted = convertLocalToGeographic(x, y, z);
            longitude = converted.longitude;
            latitude = converted.latitude;
            height = converted.height;
          }

          // Always mark entity to keep (prevent removal)
          keepModelEntityIds.add(`model-${obj.id}`);

          // Only update/create if this object actually changed or doesn't exist yet
          const entityExists = viewer.entities.getById(`model-${obj.id}`);
          if (hasChanged || !entityExists) {
            // Check if this is a 3D model file (not tiles)
            if (isModelFile(obj)) {
              try {
                createModelEntity(
                  viewer,
                  cesium,
                  {
                    id: obj.id,
                    name: obj.name,
                    url: obj.url,
                    position: obj.position as [number, number, number],
                    rotation: obj.rotation as
                      | [number, number, number]
                      | undefined,
                    scale: obj.scale as [number, number, number] | undefined,
                    interactable: obj.interactable,
                  },
                  longitude,
                  latitude,
                  height
                );
              } catch (error) {
                // Failed to load model - falling back to point
                createPointEntity(
                  viewer,
                  cesium,
                  {
                    id: obj.id,
                    name: obj.name,
                    position: obj.position as [number, number, number],
                    interactable: obj.interactable,
                  },
                  longitude,
                  latitude,
                  height
                );
              }
            } else {
              // Place simple points for objects without models
              createPointEntity(
                viewer,
                cesium,
                {
                  id: obj.id,
                  name: obj.name,
                  position: obj.position as [number, number, number],
                  interactable: obj.interactable,
                },
                longitude,
                latitude,
                height
              );
            }
          }
          // If object hasn't changed and entity exists, do nothing - entity stays as-is
        });
      }

      // Update the previous objects reference
      prevObjectsRef.current = currentObjects;

      // Remove any leftover model entities that are not in keep set
      const toRemove: any[] = [];
      viewer.entities.values.forEach((e: any) => {
        if (
          typeof e.id === "string" &&
          e.id.startsWith("model-") &&
          !keepModelEntityIds.has(e.id)
        ) {
          toRemove.push(e);
        }
      });
      toRemove.forEach((e) => viewer.entities.remove(e));
      if (toRemove.length > 0) {
        viewer.scene.requestRender();
      }
    } catch (err) {
      console.warn("[CesiumViewer] Error while rendering objects:", err);
    }
    // No cleanup function needed - the cleanup during execution (lines 187-201)
    // already handles removing orphaned entities. Adding a cleanup function here
    // would cause all entities to be removed on every dependency change, causing flicker.
  }, [world, isLoading, objects, viewer, cesium]);
}
