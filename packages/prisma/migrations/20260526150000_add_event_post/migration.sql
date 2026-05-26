-- CreateEnum
CREATE TYPE "EventBanner" AS ENUM ('purple', 'coral', 'teal', 'pink');

-- CreateEnum
CREATE TYPE "EventIcon" AS ENUM ('music', 'trophy', 'sprout', 'calendar');

-- CreateTable
CREATE TABLE "EventPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "registrationUrl" TEXT,
    "organizer" TEXT,
    "bannerColor" "EventBanner" NOT NULL DEFAULT 'purple',
    "bannerIcon" "EventIcon" NOT NULL DEFAULT 'calendar',
    "expectedAttendance" INTEGER,
    "anchors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPost_projectId_startsAt_idx" ON "EventPost"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "EventPost_organizationId_idx" ON "EventPost"("organizationId");

-- AddForeignKey
ALTER TABLE "EventPost" ADD CONSTRAINT "EventPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPost" ADD CONSTRAINT "EventPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
