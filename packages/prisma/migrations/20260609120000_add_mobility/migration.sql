-- CreateEnum
CREATE TYPE "MobilityAlertKind" AS ENUM ('offline', 'alarmed');

-- CreateTable
CREATE TABLE "MobilityDataSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentialsEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityDevice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalDeviceId" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "primaryRoad" TEXT,
    "crossRoad" TEXT,
    "mileMarker" TEXT,
    "direction" TEXT,
    "routeId" TEXT,
    "agency" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "included" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "customLabel" TEXT,
    "customRoute" TEXT,
    "groupKey" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityDeviceStatus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "online" BOOLEAN NOT NULL,
    "alarm" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MobilityDeviceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityAlert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "kind" "MobilityAlertKind" NOT NULL,
    "message" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,

    CONSTRAINT "MobilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityDataSource_projectId_idx" ON "MobilityDataSource"("projectId");

-- CreateIndex
CREATE INDEX "MobilityDevice_projectId_included_isPublic_idx" ON "MobilityDevice"("projectId", "included", "isPublic");

-- CreateIndex
CREATE INDEX "MobilityDevice_projectId_needsReview_idx" ON "MobilityDevice"("projectId", "needsReview");

-- CreateIndex
CREATE INDEX "MobilityDevice_sourceId_lastSeenAt_idx" ON "MobilityDevice"("sourceId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityDevice_sourceId_externalDeviceId_key" ON "MobilityDevice"("sourceId", "externalDeviceId");

-- CreateIndex
CREATE INDEX "MobilityDeviceStatus_deviceId_observedAt_idx" ON "MobilityDeviceStatus"("deviceId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "MobilityDeviceStatus_projectId_observedAt_idx" ON "MobilityDeviceStatus"("projectId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "MobilityAlert_projectId_closedAt_openedAt_idx" ON "MobilityAlert"("projectId", "closedAt", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "MobilityAlert_deviceId_openedAt_idx" ON "MobilityAlert"("deviceId", "openedAt" DESC);

-- AddForeignKey
ALTER TABLE "MobilityDataSource" ADD CONSTRAINT "MobilityDataSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityDevice" ADD CONSTRAINT "MobilityDevice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityDevice" ADD CONSTRAINT "MobilityDevice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MobilityDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityDeviceStatus" ADD CONSTRAINT "MobilityDeviceStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityDeviceStatus" ADD CONSTRAINT "MobilityDeviceStatus_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobilityDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAlert" ADD CONSTRAINT "MobilityAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAlert" ADD CONSTRAINT "MobilityAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobilityDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
