/**
 * Stock device-icon registry.
 *
 * Each entry pairs a stable `key` (persisted on MobilityDeviceStyle)
 * with a Lucide React icon component and a default-for hint that the
 * UI uses to pre-fill a sensible choice when the operator first opens
 * the styles page.
 *
 * The icons are rasterised client-side at map-init (see
 * `icon-rasteriser.ts`) so Mapbox can paint them on a `symbol` layer
 * — far more performant than HTML markers and crisp at every zoom.
 * They're loaded as SDF images so the symbol layer can tint them
 * with the operator's accent colour via `icon-color`.
 */
import {
  Car,
  Camera,
  CircleHelp,
  GitMerge,
  Mountain,
  ParkingCircle,
  PhoneCall,
  Radio,
  Signpost,
  ThermometerSun,
  TrafficCone,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react";

export interface StockDeviceIcon {
  /** Stable persisted key. Lowercase, hyphenated. */
  key: string;
  /** Operator-facing label. */
  label: string;
  /** Short description shown under the chip in the picker. */
  description: string;
  /** Lucide icon component. */
  Icon: LucideIcon;
  /** Subsystem keys this icon should auto-fill for on first visit. */
  defaultFor: string[];
}

/** Stock library — grow this list when adding new subsystems. */
export const STOCK_DEVICE_ICONS: StockDeviceIcon[] = [
  {
    key: "cctv-fixed",
    label: "Fixed camera",
    description: "Static CCTV.",
    Icon: Camera,
    defaultFor: ["cctv"],
  },
  {
    key: "cctv-ptz",
    label: "PTZ camera",
    description: "Pan-tilt-zoom.",
    Icon: Video,
    defaultFor: [],
  },
  {
    key: "dms-gantry",
    label: "Dynamic sign",
    description: "DMS / VMS gantry.",
    Icon: Signpost,
    defaultFor: ["dms"],
  },
  {
    key: "ramp-meter",
    label: "Ramp meter",
    description: "On-ramp control.",
    Icon: GitMerge,
    defaultFor: ["ramp", "rampMeter"],
  },
  {
    key: "traffic-signal",
    label: "Traffic signal",
    description: "Intersection control.",
    Icon: TrafficCone,
    defaultFor: ["tsc", "signal"],
  },
  {
    key: "weather",
    label: "Weather station",
    description: "RWIS / atmospheric.",
    Icon: ThermometerSun,
    defaultFor: ["rwis", "weather"],
  },
  {
    key: "count-station",
    label: "Count station",
    description: "Vehicle counter.",
    Icon: Car,
    defaultFor: ["count", "detector"],
  },
  {
    key: "parking",
    label: "Parking guidance",
    description: "Lot / garage VMS.",
    Icon: ParkingCircle,
    defaultFor: ["parking"],
  },
  {
    key: "emergency",
    label: "Emergency call",
    description: "Roadside SOS.",
    Icon: PhoneCall,
    defaultFor: ["sos", "callbox"],
  },
  {
    key: "sensor",
    label: "Pavement sensor",
    description: "Embedded in-road.",
    Icon: Waves,
    defaultFor: ["sensor"],
  },
  {
    key: "bridge",
    label: "Bridge monitor",
    description: "Structural sensor.",
    Icon: Mountain,
    defaultFor: ["bridge"],
  },
  {
    key: "beacon",
    label: "Wireless beacon",
    description: "Bluetooth / RF.",
    Icon: Radio,
    defaultFor: ["beacon", "rfid"],
  },
  {
    key: "generic",
    label: "Generic device",
    description: "Catch-all.",
    Icon: CircleHelp,
    defaultFor: [],
  },
];

const ICON_INDEX: Map<string, StockDeviceIcon> = new Map(
  STOCK_DEVICE_ICONS.map((entry) => [entry.key, entry]),
);

export function getStockIcon(key: string): StockDeviceIcon | null {
  return ICON_INDEX.get(key) ?? null;
}

/**
 * Pick the most likely stock icon for a subsystem on first run. We
 * scan the registry's `defaultFor` lists and fall back to "generic".
 * The operator can override on the Styles page.
 */
export function defaultIconKeyForSubsystem(subsystem: string): string {
  const normal = subsystem.toLowerCase();
  for (const entry of STOCK_DEVICE_ICONS) {
    if (entry.defaultFor.includes(normal)) return entry.key;
  }
  return "generic";
}
