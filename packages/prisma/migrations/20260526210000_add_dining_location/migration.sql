-- CreateTable
CREATE TABLE "DiningLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hoursText" TEXT,
    "cuisine" TEXT,
    "menuUrl" TEXT,
    "imageUrl" TEXT,
    "anchors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiningLocation_projectId_idx" ON "DiningLocation"("projectId");

-- CreateIndex
CREATE INDEX "DiningLocation_organizationId_idx" ON "DiningLocation"("organizationId");

-- AddForeignKey
ALTER TABLE "DiningLocation" ADD CONSTRAINT "DiningLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningLocation" ADD CONSTRAINT "DiningLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
