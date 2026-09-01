/**
 * Claim queued ingest jobs and run them.
 *
 * The happy path does not need this: `POST .../uploads/[id]/complete` runs the
 * job inline so a curator sees a result while still looking at the screen.
 * This exists for the unhappy paths — a function killed mid-run, a transient
 * storage error, a job enqueued before the pipeline shipped — and it is what
 * makes "queued" a state the system leaves on its own rather than one an
 * engineer has to notice.
 */
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { JOB_LEASE_MS } from "@/lib/heritage/ingest";
import { MAX_ATTEMPTS, runIngestJob, type JobOutcome } from "./run";

export interface DrainSummary {
  workerId: string;
  /** Jobs whose worker died holding the lease, returned to the queue. */
  requeued: number;
  /** Jobs that had exhausted their retries and were closed as failed. */
  abandoned: number;
  claimed: number;
  outcomes: JobOutcome[];
}

export async function drainIngestQueue(limit = 5): Promise<DrainSummary> {
  const workerId = randomUUID();
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - JOB_LEASE_MS);

  // 1. A claim older than the lease means the worker holding it is gone. Give
  //    up on jobs that have already had their attempts, requeue the rest.
  const abandoned = await prisma.heritageIngestJob.updateMany({
    where: {
      status: { in: ["claimed", "running"] },
      claimedAt: { lt: leaseCutoff },
      attempts: { gte: MAX_ATTEMPTS },
    },
    data: {
      status: "failed",
      finishedAt: now,
      claimedAt: null,
      claimedBy: null,
      failureReason:
        "Processing was attempted several times without finishing. Re-upload the file, or contact support if it keeps happening.",
    },
  });

  const requeued = await prisma.heritageIngestJob.updateMany({
    where: {
      status: { in: ["claimed", "running"] },
      claimedAt: { lt: leaseCutoff },
    },
    data: { status: "queued", claimedAt: null, claimedBy: null },
  });

  // 2. Claim. Selecting candidates and then updating with `status: "queued"`
  //    still in the predicate makes the write itself the lock: two workers
  //    racing on the same row leave exactly one winner, because the loser's
  //    row no longer matches. Reading first and trusting the read would let
  //    both run the same job.
  const candidates = await prisma.heritageIngestJob.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  if (candidates.length === 0) {
    return {
      workerId,
      requeued: requeued.count,
      abandoned: abandoned.count,
      claimed: 0,
      outcomes: [],
    };
  }

  await prisma.heritageIngestJob.updateMany({
    where: { id: { in: candidates.map((c) => c.id) }, status: "queued" },
    data: { status: "claimed", claimedBy: workerId, claimedAt: now },
  });

  const mine = await prisma.heritageIngestJob.findMany({
    where: { claimedBy: workerId, status: "claimed" },
    select: { id: true },
  });

  // 3. Run sequentially. Each job reads a few megabytes and writes a few rows,
  //    so concurrency here would buy little and risks a serverless function
  //    running out of memory on several large headers at once.
  const outcomes: JobOutcome[] = [];
  for (const { id } of mine) {
    try {
      outcomes.push(await runIngestJob(id));
    } catch (error) {
      // The runner itself broke rather than the job. Nobody is watching this
      // endpoint, so it is reported rather than only written to a row a
      // curator will never open.
      Sentry.captureException(error, {
        tags: { area: "heritage-ingest" },
        extra: { jobId: id, workerId },
      });
      // Release the claim so the next drain picks it up instead of waiting out
      // the whole lease.
      await prisma.heritageIngestJob.update({
        where: { id },
        data: {
          status: "queued",
          claimedAt: null,
          claimedBy: null,
          failureReason: null,
          result: {
            runnerError: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }

  return {
    workerId,
    requeued: requeued.count,
    abandoned: abandoned.count,
    claimed: mine.length,
    outcomes,
  };
}
