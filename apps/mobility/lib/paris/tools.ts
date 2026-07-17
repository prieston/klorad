/**
 * Read-only tool schemas Paris (the Mobility world assistant) can
 * call. Each tool is scoped to a single world via `worldId`; every
 * query filters through the world's project so a caller can't
 * reach devices or alerts outside their world.
 *
 * Design notes:
 * - `input_schema` matches Anthropic's tool-use spec — the model
 *   receives it verbatim and produces JSON arguments the executor
 *   validates before hitting the DB.
 * - Every tool returns a compact JSON string (small enough to fit
 *   in a reply turn) so we don't blow the context budget on long
 *   device catalogues.
 */
import { prisma } from "@/lib/prisma";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

export interface ParisToolAction {
  /** `focus_device` deep-links into the Map tab centred on this
   *  device; `open_alert` scrolls to a specific alert row. */
  type: "focus_device" | "open_alert";
  /** Client-side target — a device id (both types) or an alert id
   *  (open_alert). Enough for the world viewer + alerts panel to
   *  resolve without another server round-trip. */
  id: string;
  /** Short human label shown on the action card. */
  label: string;
}

export interface ParisToolResult {
  /** JSON-safe reply the model sees. Kept small. */
  reply: unknown;
  /** Optional deep-link cards surfaced to the user under the
   *  assistant's message. Rendered by the `renderActions` prop on
   *  the DS AssistantPanel. */
  actions?: ParisToolAction[];
}

export const PARIS_TOOLS = [
  {
    name: "get_open_alerts",
    description:
      "List currently-open alerts in the world (from MobilityAlert rows). Returns up to 20, newest first, filtered to devices that are in this world.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_device_status",
    description:
      "Fetch live status for a specific device by id. Returns the current online/alarm state + the raw status blob (subsystem-specific: radar has speed/volume/occupancy, DMS has message/brightness, etc.). The device must be in this world.",
    input_schema: {
      type: "object" as const,
      properties: {
        deviceId: {
          type: "string" as const,
          description: "The device's Klorad id (not the externalDeviceId).",
        },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "list_devices_by_subsystem",
    description:
      "Return every device in this world matching a subsystem (cctv | aid | dms | vsls | radar). Useful when the user asks 'show me all the cameras' or 'what radars are on the ring'.",
    input_schema: {
      type: "object" as const,
      properties: {
        subsystem: {
          type: "string" as const,
          enum: ["cctv", "aid", "dms", "vsls", "radar"],
        },
      },
      required: ["subsystem"],
    },
  },
  {
    name: "list_alert_rules",
    description:
      "Return the enabled alert rules configured on the world's project. Useful when the user asks 'what alerts am I watching for' or 'what triggers a notification'.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;

export type ParisToolName = (typeof PARIS_TOOLS)[number]["name"];

/**
 * Execute a tool call against a specific world. Returns the raw
 * result JSON (goes back into the model's context) + any deep-link
 * actions to surface to the user. Errors are turned into
 * `{error: string}` payloads instead of thrown so the model can
 * recover gracefully.
 */
export async function executeParisTool(
  name: ParisToolName,
  args: Record<string, unknown>,
  ctx: { worldId: string; projectId: string },
): Promise<ParisToolResult> {
  switch (name) {
    case "get_open_alerts": {
      // Alerts are scoped to project, but Paris only sees alerts for
      // devices that are in the current world.
      const alerts = await prisma.mobilityAlert.findMany({
        where: {
          projectId: ctx.projectId,
          closedAt: null,
          device: {
            worldMemberships: { some: { worldId: ctx.worldId } },
          },
        },
        orderBy: { openedAt: "desc" },
        take: 20,
        select: {
          id: true,
          kind: true,
          message: true,
          openedAt: true,
          acknowledgedAt: true,
          device: {
            select: { id: true, name: true, subsystem: true },
          },
        },
      });
      return {
        reply: {
          count: alerts.length,
          alerts: alerts.map((a) => ({
            id: a.id,
            kind: a.kind,
            message: a.message,
            openedAt: a.openedAt.toISOString(),
            acknowledged: a.acknowledgedAt !== null,
            device: a.device,
          })),
        },
        actions: alerts.slice(0, 3).map((a) => ({
          type: "open_alert" as const,
          id: a.id,
          label: `${a.device.name}: ${a.message.slice(0, 60)}`,
        })),
      };
    }

    case "get_device_status": {
      const deviceId = String(args.deviceId ?? "");
      if (!deviceId) return { reply: { error: "deviceId required" } };
      const membership = await prisma.mobilityWorldDevice.findFirst({
        where: { worldId: ctx.worldId, deviceId },
        select: {
          device: {
            select: {
              id: true,
              name: true,
              subsystem: true,
              externalDeviceId: true,
              source: {
                select: {
                  connectorId: true,
                  config: true,
                  credentialsEncrypted: true,
                },
              },
            },
          },
        },
      });
      if (!membership?.device) {
        return { reply: { error: "device not in this world" } };
      }
      const { device } = membership;
      try {
        const connector = await buildConnector({
          connectorId: device.source.connectorId,
          config: device.source.config as DataSourceConfigJson,
          credentials: decryptCredentials(device.source.credentialsEncrypted),
        });
        const externalId = device.externalDeviceId.startsWith(
          `${device.subsystem}:`,
        )
          ? device.externalDeviceId.slice(device.subsystem.length + 1)
          : device.externalDeviceId;
        const packed = `${device.subsystem}:${externalId}`;
        const statuses = await connector.getStatus([packed]);
        const status = statuses[packed] ?? null;
        return {
          reply: {
            device: {
              id: device.id,
              name: device.name,
              subsystem: device.subsystem,
              externalDeviceId: device.externalDeviceId,
            },
            status,
          },
          actions: [
            {
              type: "focus_device",
              id: device.id,
              label: `View ${device.name} on the map`,
            },
          ],
        };
      } catch (err) {
        return {
          reply: {
            device: { id: device.id, name: device.name },
            error: err instanceof Error ? err.message : "status fetch failed",
          },
        };
      }
    }

    case "list_devices_by_subsystem": {
      const subsystem = String(args.subsystem ?? "");
      if (!subsystem) return { reply: { error: "subsystem required" } };
      const rows = await prisma.mobilityWorldDevice.findMany({
        where: {
          worldId: ctx.worldId,
          device: { subsystem },
        },
        take: 100,
        select: {
          device: {
            select: {
              id: true,
              name: true,
              subsystem: true,
              externalDeviceId: true,
              primaryRoad: true,
              direction: true,
            },
          },
        },
      });
      const devices = rows
        .map((r) => r.device)
        .filter((d): d is NonNullable<typeof d> => d !== null);
      return {
        reply: {
          count: devices.length,
          subsystem,
          devices: devices.map((d) => ({
            id: d.id,
            name: d.name,
            externalDeviceId: d.externalDeviceId,
            primaryRoad: d.primaryRoad,
            direction: d.direction,
          })),
        },
      };
    }

    case "list_alert_rules": {
      const rules = await prisma.mobilityAlertRule.findMany({
        where: { projectId: ctx.projectId, enabled: true },
        take: 20,
        select: {
          id: true,
          name: true,
          kind: true,
          config: true,
        },
      });
      return {
        reply: {
          count: rules.length,
          rules,
        },
      };
    }
  }
}
