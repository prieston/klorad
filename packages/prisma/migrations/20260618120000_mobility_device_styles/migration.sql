-- CreateTable
CREATE TABLE "MobilityDeviceStyle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "modelKey" TEXT,
    "scale" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityDeviceStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityDeviceStyle_projectId_idx" ON "MobilityDeviceStyle"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityDeviceStyle_projectId_subsystem_key" ON "MobilityDeviceStyle"("projectId", "subsystem");

-- AddForeignKey
ALTER TABLE "MobilityDeviceStyle" ADD CONSTRAINT "MobilityDeviceStyle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
