-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "DiscoveredItemStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'queued',
    "instructions" TEXT,
    "urls" JSONB NOT NULL DEFAULT '[]',
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "extracted" JSONB NOT NULL,
    "status" "DiscoveredItemStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlJob_projectId_startedAt_idx" ON "CrawlJob"("projectId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveredItem_projectId_status_createdAt_idx" ON "DiscoveredItem"("projectId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveredItem_jobId_idx" ON "DiscoveredItem"("jobId");

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredItem" ADD CONSTRAINT "DiscoveredItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredItem" ADD CONSTRAINT "DiscoveredItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
