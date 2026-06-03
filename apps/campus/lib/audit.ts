import "server-only";
import type {
  ActivityActionType,
  ActivityEntityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Audit-log writer for Campus.
 *
 * Every write that survives in the DB should drop a row here so the
 * dashboard's "What Changed" feed can show attribution. Best-effort
 * by design: an audit-write failure is logged and swallowed so the
 * caller's primary write never gets rolled back over missing
 * history.
 *
 * The `Activity` model is platform-shared (see `packages/prisma`),
 * so we expose a thin campus-flavoured wrapper instead of letting
 * every route hand-roll the field names.
 */
export interface AuditInput {
  /** Owning organisation — always known via the project. */
  organizationId: string;
  /** Campus / project id. `null` is allowed by the model but every
   *  campus write has one, so we keep it required here. */
  projectId: string;
  /** The signed-in user that triggered the write. Pass `null` when
   *  the actor is a system job (e.g. ICS sync) — the row is dropped
   *  silently rather than committed without an actor. */
  actorId: string | null;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityActionType;
  /** Pre-rendered one-liner used as the feed row body. Keep human-
   *  readable; the feed shows it verbatim. */
  message?: string;
  /** Optional bookkeeping — anchors, counts, diff hints. */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Drop an audit row. Returns nothing — the caller never branches on
 * the result. Errors are caught and console-logged because a missing
 * row is a worse story than a broken endpoint.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  // No actor → no row. System-driven writes (sync jobs) keep happening
  // but we don't want to pollute the feed with unattributable noise
  // until we have a proper SYSTEM actor pattern.
  if (!input.actorId) return;
  try {
    await prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        message: input.message,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error("[audit] insert failed", {
      entityType: input.entityType,
      action: input.action,
      err,
    });
  }
}
