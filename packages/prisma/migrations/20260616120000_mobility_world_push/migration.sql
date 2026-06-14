-- CreateTable
CREATE TABLE "MobilityWorldPushSubscription" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "MobilityWorldPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobilityWorldPushSubscription_endpoint_key" ON "MobilityWorldPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "MobilityWorldPushSubscription_worldId_createdAt_idx" ON "MobilityWorldPushSubscription"("worldId", "createdAt");

-- AddForeignKey
ALTER TABLE "MobilityWorldPushSubscription" ADD CONSTRAINT "MobilityWorldPushSubscription_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "MobilityWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
