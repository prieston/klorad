-- CreateEnum
CREATE TYPE "MobilityAlertRuleKind" AS ENUM ('threshold', 'event');

-- AlterTable
ALTER TABLE "MobilityDataSource"
    ADD COLUMN "webhookSecret" TEXT,
    ADD COLUMN "webhookId" TEXT;

-- CreateTable
CREATE TABLE "MobilityAlertRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kind" "MobilityAlertRuleKind" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "targets" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityAlertRule_projectId_enabled_idx" ON "MobilityAlertRule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "MobilityAlertRule_sourceId_enabled_idx" ON "MobilityAlertRule"("sourceId", "enabled");

-- AddForeignKey
ALTER TABLE "MobilityAlertRule" ADD CONSTRAINT "MobilityAlertRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAlertRule" ADD CONSTRAINT "MobilityAlertRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MobilityDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
