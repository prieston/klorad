"use client";

import { Workbench } from "@klorad/design-system";
import workbenchConfig from "@/workbench.config";

interface Props {
  mapId: string;
}

/**
 * Mounts the shared Workbench shell with the campus config. v1 just
 * renders a placeholder Map view in the centre region; Phase 3 wraps
 * the real 3D scene as that view.
 *
 * The `DashboardShell` deliberately bypasses its top-bar / sidebar
 * chrome for `/workbench` routes — same as `/builder` — so the shell
 * gets the full viewport.
 */
export default function WorkbenchClient({ mapId }: Props) {
  return (
    <div className="h-screen w-screen">
      <Workbench config={workbenchConfig} worldId={mapId} />
    </div>
  );
}
