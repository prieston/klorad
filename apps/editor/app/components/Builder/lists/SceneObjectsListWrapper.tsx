import React from "react";
import { SceneObjectsList } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";

/**
 * Wrapper component that connects the generic SceneObjectsList UI component
 * to the scene store. This keeps the UI component framework-agnostic.
 */
const SceneObjectsListWrapper: React.FC = () => {
  // Combine store subscriptions to reduce from 7 to 1
  // Optimize selector: only select minimal data needed for list items
  // This prevents re-renders when object properties change (e.g., weatherData, position)
  const sceneState = useSceneStore((state) => ({
    objects: state.objects.map((obj) => ({
      id: obj.id,
      name: obj.name,
      type: obj.type,
      ref: obj.ref,
    })),
    selectObject: state.selectObject,
    removeObject: state.removeObject,
    deselectObject: state.deselectObject,
    reorderObjects: state.reorderObjects,
    previewMode: state.previewMode,
    // For selectedObject, exclude weatherData to prevent re-renders
    selectedObject: state.selectedObject
      ? (() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { weatherData, ...rest } = state.selectedObject;
          return rest;
        })()
      : null,
  }));

  const handleSelect = (id: string) => {
    // Clear Cesium feature selection when selecting a scene object
    const setSelectedCesiumFeature =
      useSceneStore.getState().setSelectedCesiumFeature;
    setSelectedCesiumFeature(null);

    if (sceneState.selectedObject?.id === id) {
      sceneState.deselectObject();
    } else {
      const object = sceneState.objects.find((obj) => obj.id === id);
      // List selection bypasses interactable check - allows selecting non-interactable models from the list
      // Scene clicks respect the interactable property (handled in SceneObjects.tsx)
      sceneState.selectObject(id, object?.ref || null);
    }
  };

  const handleDelete = (id: string) => {
    sceneState.removeObject(id);
  };

  const handleReorder = (startIndex: number, endIndex: number) => {
    sceneState.reorderObjects(startIndex, endIndex);
  };

  // Transform objects to the format expected by UI component
  const items = sceneState.objects.map((obj) => ({
    id: obj.id,
    name: obj.name || "Untitled Object",
    type: obj.type || "Unknown",
  }));

  return (
    <SceneObjectsList
      items={items}
      selectedId={sceneState.selectedObject?.id || null}
      onSelect={handleSelect}
      onDelete={handleDelete}
      onReorder={handleReorder}
      disabled={sceneState.previewMode}
    />
  );
};

export default SceneObjectsListWrapper;
