-- CreateEnum
CREATE TYPE "MobilityWorldEventKind" AS ENUM ('view', 'install', 'push_subscribe', 'push_unsubscribe', 'broadcast_sent');

-- CreateTable
CREATE TABLE "MobilityWorldEvent" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "kind" "MobilityWorldEventKind" NOT NULL,
    "anonId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityWorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityWorldEvent_worldId_createdAt_idx" ON "MobilityWorldEvent"("worldId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MobilityWorldEvent_worldId_kind_createdAt_idx" ON "MobilityWorldEvent"("worldId", "kind", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MobilityWorldEvent" ADD CONSTRAINT "MobilityWorldEvent_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "MobilityWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
