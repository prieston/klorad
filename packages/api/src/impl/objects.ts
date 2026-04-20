import { v4 as uuidv4 } from "uuid";
import { useSceneStore } from "@klorad/core";
import type { ObjectsAPI } from "../types/interfaces";
import type { SceneObject, SceneObjectInput, TransformMode, Vector3 } from "../types";

type RawObject = ReturnType<typeof useSceneStore.getState>["objects"][number];

function toSceneObject(model: RawObject): SceneObject {
  const m = model as Record<string, unknown>;
  return {
    id: model.id,
    name: model.name ?? "",
    url: model.url,
    position: (model.position as Vector3) ?? [0, 0, 0],
    rotation: (model.rotation as Vector3) ?? [0, 0, 0],
    scale: (model.scale as Vector3) ?? [1, 1, 1],
    type: (model.type as SceneObject["type"]) ?? "model",
    interactable: m.interactable !== false,
    visible: m.visible !== false,
    meta: m.meta as Record<string, unknown> | undefined,
  };
}

// Fake Vector3-compatible object that the store accepts
function vec3(arr: Vector3) {
  return { x: arr[0], y: arr[1], z: arr[2], toArray: () => arr };
}

export function createObjectsAPI(): ObjectsAPI {
  const get = () => useSceneStore.getState();

  return {
    add(input: SceneObjectInput): SceneObject {
      const model = { ...input, id: input.id ?? uuidv4() };
      get().addModel(model);
      const added = get().objects.find((o) => o.id === model.id);
      if (!added) throw new Error(`Failed to add object ${model.id}`);
      return toSceneObject(added);
    },

    remove(id) {
      get().removeObject(id);
    },

    select(id) {
      get().selectObject(id, null);
    },

    deselect() {
      get().deselectObject();
    },

    setTransform(id, transform) {
      const s = get();
      if (transform.position) s.setModelPosition(id, vec3(transform.position) as never);
      if (transform.rotation) s.setModelRotation(id, vec3(transform.rotation) as never);
      if (transform.scale) s.setModelScale(id, vec3(transform.scale) as never);
    },

    update(id, patch) {
      for (const [key, value] of Object.entries(patch)) {
        get().updateObjectProperty(id, key, value);
      }
    },

    reorder(fromIndex, toIndex) {
      get().reorderObjects(fromIndex, toIndex);
    },

    getAll() {
      return get().objects.map(toSceneObject);
    },

    getById(id) {
      const found = get().objects.find((o) => o.id === id);
      return found ? toSceneObject(found) : null;
    },

    setTransformMode(mode: TransformMode) {
      get().setTransformMode(mode);
    },
  };
}
