-- CreateEnum
CREATE TYPE "ClubColor" AS ENUM ('purple', 'coral', 'teal', 'pink');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "avatarColor" "ClubColor" NOT NULL DEFAULT 'purple',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "meetsCadence" TEXT,
    "externalLink" TEXT,
    "imageUrl" TEXT,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "anchors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Club_projectId_popularityScore_idx" ON "Club"("projectId", "popularityScore");

-- CreateIndex
CREATE INDEX "Club_organizationId_idx" ON "Club"("organizationId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
