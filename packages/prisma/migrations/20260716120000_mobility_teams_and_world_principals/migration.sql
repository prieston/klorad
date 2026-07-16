-- CreateEnum
CREATE TYPE "MobilityWorldPrincipalKind" AS ENUM ('user', 'team');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityWorldPrincipal" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "kind" "MobilityWorldPrincipalKind" NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityWorldPrincipal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityWorldPrincipal_worldId_kind_userId_teamId_key" ON "MobilityWorldPrincipal"("worldId", "kind", "userId", "teamId");

-- CreateIndex
CREATE INDEX "MobilityWorldPrincipal_worldId_idx" ON "MobilityWorldPrincipal"("worldId");

-- CreateIndex
CREATE INDEX "MobilityWorldPrincipal_userId_idx" ON "MobilityWorldPrincipal"("userId");

-- CreateIndex
CREATE INDEX "MobilityWorldPrincipal_teamId_idx" ON "MobilityWorldPrincipal"("teamId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityWorldPrincipal" ADD CONSTRAINT "MobilityWorldPrincipal_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "MobilityWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityWorldPrincipal" ADD CONSTRAINT "MobilityWorldPrincipal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityWorldPrincipal" ADD CONSTRAINT "MobilityWorldPrincipal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraint: exactly one of userId/teamId must be set, matching `kind`.
-- Postgres check constraints aren't first-class in the Prisma schema, so we
-- enforce this here to prevent malformed rows at the DB layer as a backup
-- for the API validation.
ALTER TABLE "MobilityWorldPrincipal" ADD CONSTRAINT "MobilityWorldPrincipal_kind_target_ck"
    CHECK (
        (kind = 'user' AND "userId" IS NOT NULL AND "teamId" IS NULL)
        OR
        (kind = 'team' AND "teamId" IS NOT NULL AND "userId" IS NULL)
    );
