"use client";

import React from "react";
import { XR, createXRStore } from "@react-three/xr";
import { CameraPOVCaptureHandler, ObservationPointHandler } from "./Scene";
import CameraSpringController from "../plugins/spring/CameraSpringController";
import { XRExperience } from "./XR";

const xrStore = createXRStore();

export interface XRWrapperProps {
  enabled: boolean;
  children: React.ReactNode;
  projectId?: string;
}

export default function XRWrapper({ enabled, children, projectId }: XRWrapperProps) {
  return enabled ? (
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
  );
}
