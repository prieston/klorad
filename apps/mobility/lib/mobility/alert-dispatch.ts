/**
 * Shared "open an alert + fan it out to worlds" path. Called by the
 * webhook consumer for every rule match. Extracted so future
 * evaluators (offline-for-N-minutes, sustained alarms) reuse the same
 * insert + dispatch + audit-log logic instead of copy-pasting.
 */
import { prisma } from "@/lib/prisma";
import { pushEnabled, sendPushToWorld } from "./world-push";
import { recordWorldEvent } from "./world-events";
import type { MobilityAlertKind } from "@prisma/client";

export interface DispatchInput {
  projectId: string;
  deviceId: string;
  ruleId: string;
  ruleName: string;
  kind: MobilityAlertKind;
  /** Alert body — used both as the row's `message` and the push body. */
  message: string;
  /** World ids to fan out to. Empty = alert row only, no push. */
  targetWorldIds: string[];
}

export interface DispatchResult {
  alertId: string;
  pushed: Array<{
    worldId: string;
    attempted: number;
    delivered: number;
    pruned: number;
  }>;
  pushSkipped: string | null;
}

/**
 * Insert a `MobilityAlert` and, when the rule has target worlds,
 * fan the same message to each world's subscribers. Push errors are
 * logged and swallowed so a delivery failure doesn't leave the alert
 * row un-committed. Each fan-out also appends a `broadcast_sent`
 * event to the world's audit log so rule-fired notifications show up
 * in the composer's history alongside manual broadcasts.
 */
export async function openAlertAndDispatch(
  input: DispatchInput,
): Promise<DispatchResult> {
  const alert = await prisma.mobilityAlert.create({
    data: {
      projectId: input.projectId,
      deviceId: input.deviceId,
      kind: input.kind,
      message: `[${input.ruleName}] ${input.message}`,
    },
    select: { id: true },
  });

  if (input.targetWorldIds.length === 0) {
    return { alertId: alert.id, pushed: [], pushSkipped: "no targets" };
  }
  if (!pushEnabled()) {
    return {
      alertId: alert.id,
      pushed: [],
      pushSkipped: "web push not configured",
    };
  }

  // Load slugs so the push URL can deep-link into the world. Missing
  // world ids (stale rule targets after a world was deleted) are
  // filtered out silently.
  const worlds = await prisma.mobilityWorld.findMany({
    where: { id: { in: input.targetWorldIds } },
    select: { id: true, slug: true },
  });

  const pushed: DispatchResult["pushed"] = [];
  for (const world of worlds) {
    // Deep-link straight to the device that fired the alert. The
    // WorldViewer reads `?device=<id>` on load and flies to that
    // pin — same param the manual "focus device" flow uses, so the
    // visitor lands on the alert's source pin instead of the
    // world's fit-to-all default view.
    const url = `/w/${world.slug}?device=${encodeURIComponent(input.deviceId)}`;
    try {
      const result = await sendPushToWorld(world.id, {
        title: input.ruleName,
        body: input.message,
        url,
        tag: `rule:${input.ruleId}`,
      });
      pushed.push({ worldId: world.id, ...result });
      // Mirror the manual-broadcast path so the operator's history
      // list shows rule-fired notifications too.
      await recordWorldEvent({
        worldId: world.id,
        kind: "broadcast_sent",
        meta: {
          title: input.ruleName,
          url,
          attempted: result.attempted,
          delivered: result.delivered,
          pruned: result.pruned,
          triggeredByRuleId: input.ruleId,
        },
      });
    } catch (err) {
      // Push failed for this world — log but keep dispatching to the
      // others. The alert row is already committed so the operator
      // sees the event in the alerts panel regardless.
      console.error(
        `[alert-dispatch] push to world ${world.id} failed`,
        err,
      );
      pushed.push({
        worldId: world.id,
        attempted: 0,
        delivered: 0,
        pruned: 0,
      });
    }
  }

  return { alertId: alert.id, pushed, pushSkipped: null };
}
