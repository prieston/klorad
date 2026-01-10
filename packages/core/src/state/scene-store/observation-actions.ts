import type { ObservationPoint } from "./types";

export function createObservationActions(set: any) {
  return {
    setObservationPoints: (newPoints: ObservationPoint[]) =>
      set({ observationPoints: newPoints }),

    addObservationPoint: () =>
      set((state: any) => {
        const id = Date.now();
        const newPoint: ObservationPoint = {
          id,
          title: "New Observation Point",
          description: "",
          position: null,
          target: null,
        };

        const observationPoints = [...state.observationPoints, newPoint];
        const previewIndex = observationPoints.length - 1;

        return {
          observationPoints,
          selectedObservation: newPoint,
          previewIndex,
        };
      }),

    selectObservation: (id: number | null) =>
      set((state: any) => ({
        selectedObservation:
          id === null
            ? null
            : state.observationPoints.find(
                (point: ObservationPoint) => point.id === id
              ),
        selectedObject: null,
      })),

    updateObservationPoint: (id: number, updates: Partial<ObservationPoint>) =>
      set((state: any) => {
        const updatedPoints = state.observationPoints.map((point: ObservationPoint) =>
          point.id === id ? { ...point, ...updates } : point
        );
        const updatedSelected =
          state.selectedObservation?.id === id
            ? { ...state.selectedObservation, ...updates }
            : state.selectedObservation;
        return {
          observationPoints: updatedPoints,
          selectedObservation: updatedSelected,
        };
      }),

    deleteObservationPoint: (id: number) =>
      set((state: any) => ({
        observationPoints: state.observationPoints.filter(
          (point: ObservationPoint) => point.id !== id
        ),
        selectedObservation:
          state.selectedObservation?.id === id
            ? null
            : state.selectedObservation,
      })),

    setCapturingPOV: (value: boolean) => set({ capturingPOV: value }),

    startPreview: () => set({ previewMode: true, previewIndex: 0 }),

    exitPreview: () => set({ previewMode: false, previewIndex: 0 }),

    nextObservation: () =>
      set((state: any) => {
        if (
          state.observationPoints.length === 0 ||
          state.previewIndex >= state.observationPoints.length - 1
        ) {
          return state;
        }

        const newIndex = state.previewIndex + 1;
        const nextPoint = state.observationPoints[newIndex];

        return {
          previewMode: true, // Enable preview mode to trigger camera animation
          previewIndex: newIndex,
          selectedObservation: nextPoint || state.selectedObservation,
        };
      }),

    prevObservation: () =>
      set((state: any) => {
        if (
          state.observationPoints.length === 0 ||
          state.previewIndex <= 0
        ) {
          return state;
        }

        const newIndex = state.previewIndex - 1;
        const prevPoint = state.observationPoints[newIndex];

        return {
          previewMode: true, // Enable preview mode to trigger camera animation
          previewIndex: newIndex,
          selectedObservation: prevPoint || state.selectedObservation,
        };
      }),

    reorderObservationPoints: (startIndex: number, endIndex: number) =>
      set((state: any) => {
        const newPoints = [...state.observationPoints];
        const [removed] = newPoints.splice(startIndex, 1);
        newPoints.splice(endIndex, 0, removed);

        // Update previewIndex if needed
        let newPreviewIndex = state.previewIndex;
        if (state.previewIndex === startIndex) {
          newPreviewIndex = endIndex;
        } else if (startIndex < state.previewIndex && endIndex >= state.previewIndex) {
          newPreviewIndex = state.previewIndex - 1;
        } else if (startIndex > state.previewIndex && endIndex <= state.previewIndex) {
          newPreviewIndex = state.previewIndex + 1;
        }

        return {
          observationPoints: newPoints,
          previewIndex: newPreviewIndex,
          selectedObservation: newPoints.find((p: ObservationPoint) => p.id === state.selectedObservation?.id) || state.selectedObservation,
        };
      }),
  };
}

