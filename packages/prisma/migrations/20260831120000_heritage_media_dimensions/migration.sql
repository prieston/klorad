-- Pixel dimensions read from the file header at ingest, for imagery and
-- panoramas. Additive and nullable: every existing row is valid without them,
-- and the probe backfills on the next run.
ALTER TABLE "HeritageRepresentation" ADD COLUMN     "heightPx" INTEGER,
ADD COLUMN     "widthPx" INTEGER;
