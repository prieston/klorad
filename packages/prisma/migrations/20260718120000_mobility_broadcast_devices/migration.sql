-- AlterTable
ALTER TABLE "Broadcast"
    ADD COLUMN "worldId" TEXT,
    ADD COLUMN "deviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Broadcast_worldId_createdAt_idx" ON "Broadcast"("worldId", "createdAt");

-- AddForeignKey
ALTER TABLE "Broadcast"
    ADD CONSTRAINT "Broadcast_worldId_fkey"
    FOREIGN KEY ("worldId") REFERENCES "MobilityWorld"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
