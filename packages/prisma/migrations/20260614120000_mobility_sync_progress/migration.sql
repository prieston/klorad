-- Sync progress tracking for MobilityDataSource so the dashboard can
-- render a real progress card while a slow sync ticks through pages.
-- All three columns are nullable (NULL = idle / never synced).

ALTER TABLE "MobilityDataSource"
  ADD COLUMN     "syncStatus" TEXT,
  ADD COLUMN     "syncStartedAt" TIMESTAMP(3),
  ADD COLUMN     "syncProgress" JSONB;
