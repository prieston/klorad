"use client";

import React from "react";
import { XR, createXRStore } from "@react-three/xr";
import CameraSpringController from "../spring/CameraSpringController";
import ObservationPointHandler from "../../components/Scene/ObservationPointHandler";
import CameraPOVCaptureHandler from "../../components/Scene/CameraPOVCaptureHandler";
import { XRExperience } from "../../components/XR";

// Create an XR store for XR usage
const xrStore = createXRStore();

interface XRWrapperProps {
  enabled: boolean;
  children: React.ReactNode;
  projectId?: string;
}

const XRWrapper: React.FC<XRWrapperProps> = ({ enabled, children, projectId }) => {
  return (
    <>
      {enabled ? (
        <XR store={xrStore}>
          <XRExperience projectId={projectId} />
          {children}
        </XR>
      ) : (
        <>
          <CameraSpringController />
          <ObservationPointHandler />
          <CameraPOVCaptureHandler />
          {children}
        </>
      )}
    </>
  );
};

export default XRWrapper;
