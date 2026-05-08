import { useSceneStore } from "@klorad/core";
import type { TourAPI } from "../types/interfaces";
import type { TourStop, Vector3 } from "../types";

type RawPoint = ReturnType<typeof useSceneStore.getState>["observationPoints"][number];

function toTourStop(p: RawPoint): TourStop {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    cameraPosition: p.position as Vector3 | null,
    cameraTarget: p.target as Vector3 | null,
    linkedObjectId: p.connectedModelId,
  };
}

export function createTourAPI(): TourAPI {
  const get = () => useSceneStore.getState();

  return {
    addStop(): TourStop {
      get().addObservationPoint();
      const points = get().observationPoints;
      return toTourStop(points[points.length - 1]);
    },

    updateStop(id, patch) {
      get().updateObservationPoint(id, {
        title: patch.title,
        description: patch.description,
        position: patch.cameraPosition ?? undefined,
        target: patch.cameraTarget ?? undefined,
        connectedModelId: patch.linkedObjectId,
      });
    },

    deleteStop(id) {
      get().deleteObservationPoint(id);
    },

    reorderStops(fromIndex, toIndex) {
      get().reorderObservationPoints(fromIndex, toIndex);
    },

    play(options) {
      if (options?.speed !== undefined) get().setPlaybackSpeed(options.speed);
      get().startPreview();
    },

    stop() {
      get().exitPreview();
    },

    next() {
      get().nextObservation();
    },

    prev() {
      get().prevObservation();
    },

    goTo(index) {
      const point = get().observationPoints[index];
      if (point) get().selectObservation(point.id);
    },

    getAll(): TourStop[] {
      return get().observationPoints.map(toTourStop);
    },

    getCurrent(): TourStop | null {
      const s = get();
      if (!s.previewMode) return null;
      const current = s.observationPoints[s.previewIndex];
      return current ? toTourStop(current) : null;
    },
  };
}
