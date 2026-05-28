-- AlterTable
ALTER TABLE "EventPost" ADD COLUMN "externalId" TEXT;
ALTER TABLE "EventPost" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EventPost_projectId_externalId_key" ON "EventPost"("projectId", "externalId");
