"use client";

import { TeleportationController } from "./TeleportationController";
import { InteractionController } from "./InteractionController";
import { SpatialUIContainer } from "./SpatialUIContainer";
import { ModelHighlight } from "./ModelHighlight";
import { useSceneStore } from "@klorad/core";
import { useXRStore } from "@klorad/core";

interface XRExperienceProps {
  projectId?: string;
}

export const XRExperience: React.FC<XRExperienceProps> = ({ projectId }) => {
  const objects = useSceneStore((state) => state.objects);

  // Filter interactable models for highlighting
  const interactableModels = objects.filter((obj) => obj.interactable === true);

  return (
    <>
      {/* Teleportation system (left controller) */}
      <TeleportationController />

      {/* Interaction system (right controller) */}
      <InteractionController />

      {/* Model highlights for hovered interactable models */}
      {interactableModels.map((model) => (
        <ModelHighlight key={model.id} modelId={model.id} />
      ))}

      {/* Spatial UI container for selected model */}
      <SpatialUIContainer projectId={projectId} />
    </>
  );
};
