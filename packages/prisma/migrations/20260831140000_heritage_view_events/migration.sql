-- Daily view counts, aggregated on write. No per-visitor row, no IP, no
-- session identifier, no timestamp finer than a day: there is nothing here
-- to disclose in a data-protection review.
--
-- The nullable-looking columns default to '' rather than NULL because the
-- unique index spans them, and Postgres treats NULLs as distinct — a
-- nullable column would let the aggregation silently stop aggregating.

-- CreateEnum
CREATE TYPE "HeritageViewKind" AS ENUM ('venue', 'scene', 'object', 'tour');
-- CreateTable
CREATE TABLE "HeritageViewEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" "HeritageViewKind" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "isEmbed" BOOLEAN NOT NULL DEFAULT false,
    "referrerHost" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '',
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "HeritageViewEvent_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "HeritageViewEvent_venueId_day_idx" ON "HeritageViewEvent"("venueId", "day");
-- CreateIndex
CREATE UNIQUE INDEX "HeritageViewEvent_venueId_kind_targetId_isEmbed_referrerHos_key" ON "HeritageViewEvent"("venueId", "kind", "targetId", "isEmbed", "referrerHost", "language", "day");
-- AddForeignKey
ALTER TABLE "HeritageViewEvent" ADD CONSTRAINT "HeritageViewEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
