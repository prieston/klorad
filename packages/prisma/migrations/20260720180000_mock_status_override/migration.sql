-- CreateTable
CREATE TABLE "MockStatusOverride" (
    "externalId" TEXT NOT NULL,
    "patch" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockStatusOverride_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE INDEX "MockStatusOverride_expiresAt_idx" ON "MockStatusOverride"("expiresAt");
