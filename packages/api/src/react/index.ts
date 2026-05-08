"use client";

import { useEffect, useRef } from "react";
import { useSceneStore } from "@klorad/core";
import type { SceneAPI, SceneEventBusAPI } from "../types/interfaces";
import type {
  SceneObject,
  TourStop,
  SceneEventType,
  SceneEventHandler,
} from "../types";

// ---------------------------------------------------------------------------
// useObjects — reactive list of all scene objects
// ---------------------------------------------------------------------------
export function useObjects(): SceneObject[] {
  const raw = useSceneStore((s) => s.objects);
  return raw.map((obj) => ({
    id: obj.id,
    name: obj.name ?? "",
    url: obj.url,
    position: obj.position as [number, number, number],
    rotation: (obj.rotation ?? [0, 0, 0]) as [number, number, number],
    scale: (obj.scale ?? [1, 1, 1]) as [number, number, number],
    type: (obj.type ?? "model") as SceneObject["type"],
    interactable: obj.interactable ?? false,
    visible: obj.visible !== false,
    meta: obj.meta as Record<string, unknown> | undefined,
  }));
}

// ---------------------------------------------------------------------------
// useSelectedObject — reactive selected object
// ---------------------------------------------------------------------------
export function useSelectedObject(): SceneObject | null {
  const selected = useSceneStore((s) => s.selectedObject);
  if (!selected) return null;
  return {
    id: selected.id,
    name: selected.name ?? "",
    url: selected.url,
    position: selected.position as [number, number, number],
    rotation: (selected.rotation ?? [0, 0, 0]) as [number, number, number],
    scale: (selected.scale ?? [1, 1, 1]) as [number, number, number],
    type: (selected.type ?? "model") as SceneObject["type"],
    interactable: selected.interactable ?? false,
    visible: selected.visible !== false,
    meta: selected.meta as Record<string, unknown> | undefined,
  };
}

// ---------------------------------------------------------------------------
// useTour — reactive tour state
// ---------------------------------------------------------------------------
export function useTour(): {
  stops: TourStop[];
  current: TourStop | null;
  isPlaying: boolean;
} {
  const observationPoints = useSceneStore((s) => s.observationPoints);
  const previewMode = useSceneStore((s) => s.previewMode);
  const previewIndex = useSceneStore((s) => s.previewIndex);

  const stops: TourStop[] = observationPoints.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    cameraPosition: p.position as [number, number, number] | null,
    cameraTarget: p.target as [number, number, number] | null,
    linkedObjectId: p.connectedModelId,
  }));

  const currentRaw = previewMode ? observationPoints[previewIndex] : null;
  const current: TourStop | null = currentRaw
    ? {
        id: currentRaw.id,
        title: currentRaw.title,
        description: currentRaw.description,
        cameraPosition: currentRaw.position as [number, number, number] | null,
        cameraTarget: currentRaw.target as [number, number, number] | null,
        linkedObjectId: currentRaw.connectedModelId,
      }
    : null;

  return { stops, current, isPlaying: previewMode };
}

// ---------------------------------------------------------------------------
// useSceneEvent — subscribe to a scene event via the API event bus
// ---------------------------------------------------------------------------
export function useSceneEvent<T extends SceneEventType>(
  bus: SceneEventBusAPI,
  event: T,
  handler: SceneEventHandler<T>
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stable: SceneEventHandler<T> = (payload) => handlerRef.current(payload);
    return bus.on(event, stable);
  }, [bus, event]);
}

// ---------------------------------------------------------------------------
// useScene — returns the SceneAPI instance from React context.
// Apps should create a context that provides the SceneAPI and wrap this hook.
// ---------------------------------------------------------------------------
export type { SceneAPI };
