import { create } from "zustand";
import * as THREE from "three";

interface XRState {
  // Teleportation state
  teleportTarget: THREE.Vector3 | null;
  isTeleporting: boolean;

  // Interaction state
  hoveredModelId: string | null;
  selectedModelId: string | null;
  openContainerId: string | null;

  // Controller positions (for reference)
  controllerPositions: {
    left: THREE.Vector3 | null;
    right: THREE.Vector3 | null;
  };

  // Actions
  setTeleportTarget: (target: THREE.Vector3 | null) => void;
  setIsTeleporting: (isTeleporting: boolean) => void;
  setHoveredModelId: (modelId: string | null) => void;
  setSelectedModelId: (modelId: string | null) => void;
  setOpenContainerId: (containerId: string | null) => void;
  setControllerPosition: (hand: "left" | "right", position: THREE.Vector3 | null) => void;
  closeContainer: () => void;
}

export const useXRStore = create<XRState>((set) => ({
  // Initial state
  teleportTarget: null,
  isTeleporting: false,
  hoveredModelId: null,
  selectedModelId: null,
  openContainerId: null,
  controllerPositions: {
    left: null,
    right: null,
  },

  // Actions
  setTeleportTarget: (target) => set({ teleportTarget: target }),
  setIsTeleporting: (isTeleporting) => set({ isTeleporting }),
  setHoveredModelId: (modelId) => set({ hoveredModelId: modelId }),
  setSelectedModelId: (modelId) => {
    set((state) => {
      // If selecting a new model, close any existing container first
      if (modelId && modelId !== state.selectedModelId) {
        return {
          selectedModelId: modelId,
          openContainerId: modelId, // Open container for selected model
        };
      }
      return { selectedModelId: modelId };
    });
  },
  setOpenContainerId: (containerId) => set({ openContainerId: containerId }),
  setControllerPosition: (hand, position) =>
    set((state) => ({
      controllerPositions: {
        ...state.controllerPositions,
        [hand]: position,
      },
    })),
  closeContainer: () => set({ openContainerId: null, selectedModelId: null }),
}));
