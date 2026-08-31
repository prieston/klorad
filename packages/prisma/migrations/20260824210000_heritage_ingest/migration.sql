-- CreateEnum
CREATE TYPE "HeritageUploadStatus" AS ENUM ('pending', 'in_progress', 'completed', 'aborted', 'expired');

-- CreateEnum
CREATE TYPE "HeritageIngestJobKind" AS ENUM ('splat_pipeline', 'mesh_pipeline', 'point_cloud_conversion', 'media_probe');

-- CreateEnum
CREATE TYPE "HeritageIngestJobStatus" AS ENUM ('queued', 'claimed', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "HeritageUploadSession" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "representationId" TEXT,
    "storageKey" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "partSize" INTEGER NOT NULL,
    "partCount" INTEGER NOT NULL,
    "purpose" "HeritageFilePurpose" NOT NULL DEFAULT 'master',
    "status" "HeritageUploadStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageUploadPart" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "eTag" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeritageUploadPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageIngestJob" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "kind" "HeritageIngestJobKind" NOT NULL,
    "status" "HeritageIngestJobStatus" NOT NULL DEFAULT 'queued',
    "parameters" JSONB,
    "result" JSONB,
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "estimatedSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageIngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeritageUploadSession_venueId_status_idx" ON "HeritageUploadSession"("venueId", "status");

-- CreateIndex
CREATE INDEX "HeritageUploadSession_representationId_idx" ON "HeritageUploadSession"("representationId");

-- CreateIndex
CREATE INDEX "HeritageUploadSession_status_expiresAt_idx" ON "HeritageUploadSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "HeritageUploadPart_sessionId_idx" ON "HeritageUploadPart"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageUploadPart_sessionId_partNumber_key" ON "HeritageUploadPart"("sessionId", "partNumber");

-- CreateIndex
CREATE INDEX "HeritageIngestJob_venueId_status_idx" ON "HeritageIngestJob"("venueId", "status");

-- CreateIndex
CREATE INDEX "HeritageIngestJob_representationId_idx" ON "HeritageIngestJob"("representationId");

-- CreateIndex
CREATE INDEX "HeritageIngestJob_status_createdAt_idx" ON "HeritageIngestJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "HeritageUploadSession" ADD CONSTRAINT "HeritageUploadSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageUploadSession" ADD CONSTRAINT "HeritageUploadSession_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "HeritageRepresentation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageUploadPart" ADD CONSTRAINT "HeritageUploadPart_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HeritageUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageIngestJob" ADD CONSTRAINT "HeritageIngestJob_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageIngestJob" ADD CONSTRAINT "HeritageIngestJob_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "HeritageRepresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

