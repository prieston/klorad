-- CreateTable
CREATE TABLE "MobilityCustomIcon" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityCustomIcon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityCustomIcon_projectId_idx" ON "MobilityCustomIcon"("projectId");

-- AddForeignKey
ALTER TABLE "MobilityCustomIcon" ADD CONSTRAINT "MobilityCustomIcon_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
