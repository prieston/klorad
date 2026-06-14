-- CreateEnum
CREATE TYPE "MobilityWorldVisibility" AS ENUM ('public', 'linkOnly', 'authenticated');

-- CreateTable
CREATE TABLE "MobilityWorld" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "MobilityWorldVisibility" NOT NULL DEFAULT 'linkOnly',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityWorld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityWorldDevice" (
    "worldId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityWorldDevice_pkey" PRIMARY KEY ("worldId", "deviceId")
);

-- CreateIndex
CREATE INDEX "MobilityWorld_projectId_idx" ON "MobilityWorld"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityWorld_projectId_slug_key" ON "MobilityWorld"("projectId", "slug");

-- CreateIndex
CREATE INDEX "MobilityWorldDevice_deviceId_idx" ON "MobilityWorldDevice"("deviceId");

-- AddForeignKey
ALTER TABLE "MobilityWorld" ADD CONSTRAINT "MobilityWorld_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityWorldDevice" ADD CONSTRAINT "MobilityWorldDevice_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "MobilityWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityWorldDevice" ADD CONSTRAINT "MobilityWorldDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobilityDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
