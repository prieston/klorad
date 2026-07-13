/**
 * Central lookup for subsystem → icon + label. Every UI surface that
 * renders a device row (Operator drawer, public WorldViewer, Discovered
 * list, Alerts feed, DevicesClient table, WorldEditor filter chips) used
 * to hardcode a `cctv → Camera / dms → Signpost / else → Radio`
 * ternary. Adding a new subsystem — as we did for the PSMdt-iNET demo
 * (aid / vms / vsls / radar) — required editing every one of those
 * files. This helper puts the mapping in one place.
 *
 * When a new subsystem lands in `@klorad/connectors/inet-atms`
 * `INET_SUBSYSTEMS`, add a case here and every consumer picks it up.
 */
import {
  Camera,
  Gauge,
  Radar,
  Radio,
  ScanEye,
  Signpost,
  type LucideIcon,
} from "lucide-react";

export interface SubsystemDescriptor {
  /** Component to render — always the same shape as `Camera` /
   *  `Signpost` so consumers can keep their existing `<Icon .../>` sites
   *  untouched. */
  icon: LucideIcon;
  /** Short label suitable for a badge or chip. Falls back to the raw
   *  subsystem string when there's no branded label. */
  label: string;
}

/**
 * The `subsystem` field on `MobilityDevice` is a free-text string
 * chosen by the connector. Historically it's been one of the values
 * below, but we don't want a strict enum here so the UI keeps
 * rendering *something* if a future connector emits a new value.
 */
export function subsystemDescriptor(subsystem: string | null | undefined): SubsystemDescriptor {
  switch ((subsystem ?? "").toLowerCase()) {
    case "cctv":
      return { icon: Camera, label: "CCTV" };
    case "aid":
      // Automated Incident Detection — a camera that watches for
      // events rather than serving a live feed. `ScanEye` reads as
      // "camera + attention" which matches the pitch language.
      return { icon: ScanEye, label: "AID" };
    case "dms":
      return { icon: Signpost, label: "DMS" };
    case "vms":
      // Variable Message Sign — same wire shape as DMS, different
      // regional name. Reuse the sign icon.
      return { icon: Signpost, label: "VMS" };
    case "vsls":
      // Variable Speed Limit Signs. Gauge reads as speed.
      return { icon: Gauge, label: "VSLS" };
    case "radar":
      return { icon: Radar, label: "RADAR" };
    default:
      return {
        icon: Radio,
        label: (subsystem ?? "").toUpperCase() || "DEVICE",
      };
  }
}

/** Sugar for the common site — `const Icon = subsystemIcon(device.subsystem)`. */
export function subsystemIcon(subsystem: string | null | undefined): LucideIcon {
  return subsystemDescriptor(subsystem).icon;
}

/** Sugar for badge / chip text. */
export function subsystemLabel(subsystem: string | null | undefined): string {
  return subsystemDescriptor(subsystem).label;
}
