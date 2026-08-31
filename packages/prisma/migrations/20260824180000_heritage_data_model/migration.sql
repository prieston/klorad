-- CreateEnum
CREATE TYPE "HeritagePublishState" AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "HeritageVenueKind" AS ENUM ('museum', 'archaeological_site', 'monument', 'collection', 'cultural_route');

-- CreateEnum
CREATE TYPE "HeritageSpaceKind" AS ENUM ('gallery', 'room', 'sector', 'scanned_scene', 'exterior', 'storage');

-- CreateEnum
CREATE TYPE "HeritageSceneKind" AS ENUM ('mesh', 'splat', 'composite', 'panorama');

-- CreateEnum
CREATE TYPE "HeritageProcessingStatus" AS ENUM ('pending', 'uploading', 'queued', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "HeritageRepresentationKind" AS ENUM ('mesh', 'splat', 'point_cloud', 'image', 'audio', 'video', 'panorama');

-- CreateEnum
CREATE TYPE "HeritageFilePurpose" AS ENUM ('master', 'delivery', 'tileset', 'lod', 'thumbnail', 'transcript', 'caption');

-- CreateEnum
CREATE TYPE "HeritageProxyShape" AS ENUM ('box', 'sphere', 'cylinder', 'plane', 'mesh');

-- CreateEnum
CREATE TYPE "HeritageProxyInteraction" AS ENUM ('none', 'info', 'tour_stop', 'external_link', 'scene_link');

-- CreateEnum
CREATE TYPE "HeritageRights" AS ENUM ('cc0', 'public_domain_mark', 'cc_by', 'cc_by_sa', 'cc_by_nd', 'cc_by_nc', 'cc_by_nc_sa', 'cc_by_nc_nd', 'noc_nc', 'noc_oklr', 'in_c', 'in_c_edu', 'in_c_ow_eu', 'cne');

-- CreateEnum
CREATE TYPE "HeritageCaptureMethod" AS ENUM ('photogrammetry', 'laser_scan', 'structured_light', 'gaussian_splat', 'manual_model', 'photography', 'born_digital', 'unknown');

-- CreateEnum
CREATE TYPE "HeritageEvidenceClass" AS ENUM ('surveyed', 'inferred', 'conjectural', 'unknown');

-- CreateEnum
CREATE TYPE "HeritageActorKind" AS ENUM ('person', 'group', 'institution');

-- CreateEnum
CREATE TYPE "HeritageEventKind" AS ENUM ('creation', 'excavation', 'acquisition', 'transfer', 'conservation', 'destruction', 'exhibition', 'publication');

-- CreateEnum
CREATE TYPE "HeritageSceneLayerRole" AS ENUM ('base', 'overlay', 'object', 'proxy_source', 'environment');

-- CreateEnum
CREATE TYPE "HeritageTourMode" AS ENUM ('screen', 'headset', 'both');

-- CreateTable
CREATE TABLE "HeritageVenue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "HeritageVenueKind" NOT NULL DEFAULT 'museum',
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "summary" JSONB,
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "address" JSONB,
    "scanOfPublicDomainAssertsRights" BOOLEAN NOT NULL DEFAULT false,
    "defaultRights" "HeritageRights" NOT NULL DEFAULT 'in_c',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageVenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageSpace" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" "HeritageSpaceKind" NOT NULL DEFAULT 'gallery',
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "floor" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageScene" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "spaceId" TEXT,
    "kind" "HeritageSceneKind" NOT NULL DEFAULT 'mesh',
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "status" "HeritageProcessingStatus" NOT NULL DEFAULT 'pending',
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "tilesetUrl" TEXT,
    "initialCamera" JSONB,
    "environment" JSONB,
    "floorProxyUrl" TEXT,
    "splatBudget" INTEGER,
    "triangleCount" INTEGER,
    "lastRecapturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageSceneLayer" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "role" "HeritageSceneLayerRole" NOT NULL DEFAULT 'base',
    "transform" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageSceneLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageObject" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "spaceId" TEXT,
    "slug" TEXT NOT NULL,
    "identifier" TEXT,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "creditLine" JSONB,
    "objectType" TEXT,
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensions" JSONB,
    "provenance" JSONB,
    "currentLocation" JSONB,
    "periodId" TEXT,
    "rights" "HeritageRights",
    "rightsHolder" TEXT,
    "externalUri" TEXT,
    "cmsSourceId" TEXT,
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageRepresentation" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "objectId" TEXT,
    "spaceId" TEXT,
    "kind" "HeritageRepresentationKind" NOT NULL,
    "status" "HeritageProcessingStatus" NOT NULL DEFAULT 'pending',
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "label" JSONB,
    "splatCount" INTEGER,
    "triangleCount" INTEGER,
    "boundingBox" JSONB,
    "durationSec" DOUBLE PRECISION,
    "rights" "HeritageRights",
    "rightsHolder" TEXT,
    "rightsNote" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageRepresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageRepresentationFile" (
    "id" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "purpose" "HeritageFilePurpose" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "format" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "checksum" TEXT,
    "lodLevel" INTEGER,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageRepresentationFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageParadata" (
    "id" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "method" "HeritageCaptureMethod" NOT NULL DEFAULT 'unknown',
    "deviceName" TEXT,
    "processingChain" JSONB,
    "capturedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "operatorActorId" TEXT,
    "vigieComplexity" TEXT,
    "intendedPurpose" TEXT,
    "accuracyMeters" DOUBLE PRECISION,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageParadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageProxy" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "objectId" TEXT,
    "shape" "HeritageProxyShape" NOT NULL DEFAULT 'box',
    "interaction" "HeritageProxyInteraction" NOT NULL DEFAULT 'info',
    "transform" JSONB NOT NULL,
    "geometryUrl" TEXT,
    "label" JSONB,
    "href" TEXT,
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageProxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritagePeriod" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "note" JSONB,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageActor" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" "HeritageActorKind" NOT NULL DEFAULT 'person',
    "name" JSONB NOT NULL,
    "note" JSONB,
    "externalUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "kind" "HeritageEventKind" NOT NULL,
    "objectId" TEXT,
    "actorId" TEXT,
    "periodId" TEXT,
    "title" JSONB,
    "note" JSONB,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dateDisplay" JSONB,
    "place" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageReconstructionState" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "spaceId" TEXT,
    "objectId" TEXT,
    "sceneId" TEXT,
    "periodId" TEXT,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "evidence" "HeritageEvidenceClass" NOT NULL DEFAULT 'unknown',
    "confidence" INTEGER,
    "sources" JSONB,
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageReconstructionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageTour" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "mode" "HeritageTourMode" NOT NULL DEFAULT 'both',
    "state" "HeritagePublishState" NOT NULL DEFAULT 'draft',
    "estimatedMinutes" INTEGER,
    "isAccessibleRoute" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeritageTourStop" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "sceneId" TEXT,
    "objectId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" JSONB NOT NULL,
    "body" JSONB,
    "cameraPose" JSONB,
    "audioRepresentationId" TEXT,
    "mediaRepresentationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritageTourStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeritageVenue_projectId_key" ON "HeritageVenue"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageVenue_slug_key" ON "HeritageVenue"("slug");

-- CreateIndex
CREATE INDEX "HeritageSpace_venueId_state_idx" ON "HeritageSpace"("venueId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageSpace_venueId_slug_key" ON "HeritageSpace"("venueId", "slug");

-- CreateIndex
CREATE INDEX "HeritageScene_venueId_state_idx" ON "HeritageScene"("venueId", "state");

-- CreateIndex
CREATE INDEX "HeritageScene_spaceId_idx" ON "HeritageScene"("spaceId");

-- CreateIndex
CREATE INDEX "HeritageScene_status_idx" ON "HeritageScene"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageScene_venueId_slug_key" ON "HeritageScene"("venueId", "slug");

-- CreateIndex
CREATE INDEX "HeritageSceneLayer_sceneId_idx" ON "HeritageSceneLayer"("sceneId");

-- CreateIndex
CREATE INDEX "HeritageSceneLayer_representationId_idx" ON "HeritageSceneLayer"("representationId");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageSceneLayer_sceneId_representationId_role_key" ON "HeritageSceneLayer"("sceneId", "representationId", "role");

-- CreateIndex
CREATE INDEX "HeritageObject_venueId_state_idx" ON "HeritageObject"("venueId", "state");

-- CreateIndex
CREATE INDEX "HeritageObject_spaceId_idx" ON "HeritageObject"("spaceId");

-- CreateIndex
CREATE INDEX "HeritageObject_periodId_idx" ON "HeritageObject"("periodId");

-- CreateIndex
CREATE INDEX "HeritageObject_venueId_cmsSourceId_idx" ON "HeritageObject"("venueId", "cmsSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageObject_venueId_slug_key" ON "HeritageObject"("venueId", "slug");

-- CreateIndex
CREATE INDEX "HeritageRepresentation_venueId_state_idx" ON "HeritageRepresentation"("venueId", "state");

-- CreateIndex
CREATE INDEX "HeritageRepresentation_objectId_idx" ON "HeritageRepresentation"("objectId");

-- CreateIndex
CREATE INDEX "HeritageRepresentation_spaceId_idx" ON "HeritageRepresentation"("spaceId");

-- CreateIndex
CREATE INDEX "HeritageRepresentation_status_idx" ON "HeritageRepresentation"("status");

-- CreateIndex
CREATE INDEX "HeritageRepresentationFile_representationId_purpose_idx" ON "HeritageRepresentationFile"("representationId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageParadata_representationId_key" ON "HeritageParadata"("representationId");

-- CreateIndex
CREATE INDEX "HeritageParadata_operatorActorId_idx" ON "HeritageParadata"("operatorActorId");

-- CreateIndex
CREATE INDEX "HeritageProxy_sceneId_state_idx" ON "HeritageProxy"("sceneId", "state");

-- CreateIndex
CREATE INDEX "HeritageProxy_objectId_idx" ON "HeritageProxy"("objectId");

-- CreateIndex
CREATE INDEX "HeritageProxy_venueId_idx" ON "HeritageProxy"("venueId");

-- CreateIndex
CREATE INDEX "HeritagePeriod_venueId_idx" ON "HeritagePeriod"("venueId");

-- CreateIndex
CREATE INDEX "HeritageActor_venueId_idx" ON "HeritageActor"("venueId");

-- CreateIndex
CREATE INDEX "HeritageEvent_venueId_kind_idx" ON "HeritageEvent"("venueId", "kind");

-- CreateIndex
CREATE INDEX "HeritageEvent_objectId_idx" ON "HeritageEvent"("objectId");

-- CreateIndex
CREATE INDEX "HeritageEvent_actorId_idx" ON "HeritageEvent"("actorId");

-- CreateIndex
CREATE INDEX "HeritageEvent_periodId_idx" ON "HeritageEvent"("periodId");

-- CreateIndex
CREATE INDEX "HeritageReconstructionState_venueId_state_idx" ON "HeritageReconstructionState"("venueId", "state");

-- CreateIndex
CREATE INDEX "HeritageReconstructionState_objectId_idx" ON "HeritageReconstructionState"("objectId");

-- CreateIndex
CREATE INDEX "HeritageReconstructionState_sceneId_idx" ON "HeritageReconstructionState"("sceneId");

-- CreateIndex
CREATE INDEX "HeritageReconstructionState_periodId_idx" ON "HeritageReconstructionState"("periodId");

-- CreateIndex
CREATE INDEX "HeritageReconstructionState_spaceId_idx" ON "HeritageReconstructionState"("spaceId");

-- CreateIndex
CREATE INDEX "HeritageTour_venueId_state_idx" ON "HeritageTour"("venueId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "HeritageTour_venueId_slug_key" ON "HeritageTour"("venueId", "slug");

-- CreateIndex
CREATE INDEX "HeritageTourStop_tourId_sortOrder_idx" ON "HeritageTourStop"("tourId", "sortOrder");

-- CreateIndex
CREATE INDEX "HeritageTourStop_sceneId_idx" ON "HeritageTourStop"("sceneId");

-- CreateIndex
CREATE INDEX "HeritageTourStop_objectId_idx" ON "HeritageTourStop"("objectId");

-- AddForeignKey
ALTER TABLE "HeritageVenue" ADD CONSTRAINT "HeritageVenue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageSpace" ADD CONSTRAINT "HeritageSpace_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageScene" ADD CONSTRAINT "HeritageScene_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageScene" ADD CONSTRAINT "HeritageScene_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "HeritageSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageSceneLayer" ADD CONSTRAINT "HeritageSceneLayer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "HeritageScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageSceneLayer" ADD CONSTRAINT "HeritageSceneLayer_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "HeritageRepresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageObject" ADD CONSTRAINT "HeritageObject_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageObject" ADD CONSTRAINT "HeritageObject_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "HeritageSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageObject" ADD CONSTRAINT "HeritageObject_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "HeritagePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageRepresentation" ADD CONSTRAINT "HeritageRepresentation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageRepresentation" ADD CONSTRAINT "HeritageRepresentation_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "HeritageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageRepresentation" ADD CONSTRAINT "HeritageRepresentation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "HeritageSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageRepresentationFile" ADD CONSTRAINT "HeritageRepresentationFile_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "HeritageRepresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageParadata" ADD CONSTRAINT "HeritageParadata_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "HeritageRepresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageParadata" ADD CONSTRAINT "HeritageParadata_operatorActorId_fkey" FOREIGN KEY ("operatorActorId") REFERENCES "HeritageActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageProxy" ADD CONSTRAINT "HeritageProxy_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageProxy" ADD CONSTRAINT "HeritageProxy_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "HeritageScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageProxy" ADD CONSTRAINT "HeritageProxy_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "HeritageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritagePeriod" ADD CONSTRAINT "HeritagePeriod_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageActor" ADD CONSTRAINT "HeritageActor_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageEvent" ADD CONSTRAINT "HeritageEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageEvent" ADD CONSTRAINT "HeritageEvent_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "HeritageObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageEvent" ADD CONSTRAINT "HeritageEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "HeritageActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageEvent" ADD CONSTRAINT "HeritageEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "HeritagePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageReconstructionState" ADD CONSTRAINT "HeritageReconstructionState_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageReconstructionState" ADD CONSTRAINT "HeritageReconstructionState_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "HeritageSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageReconstructionState" ADD CONSTRAINT "HeritageReconstructionState_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "HeritageObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageReconstructionState" ADD CONSTRAINT "HeritageReconstructionState_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "HeritageScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageReconstructionState" ADD CONSTRAINT "HeritageReconstructionState_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "HeritagePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageTour" ADD CONSTRAINT "HeritageTour_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "HeritageVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageTourStop" ADD CONSTRAINT "HeritageTourStop_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "HeritageTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageTourStop" ADD CONSTRAINT "HeritageTourStop_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "HeritageScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeritageTourStop" ADD CONSTRAINT "HeritageTourStop_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "HeritageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

