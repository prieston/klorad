-- Add apps tagging for organizations so each Klorad product (editor, campus, ...)
-- can filter its org list to tenants that were granted access to it.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "apps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing non-personal orgs with the editor app so the current
-- editor tenant list stays intact. Campus and future apps opt-in explicitly.
UPDATE "Organization"
   SET "apps" = ARRAY['editor']
 WHERE "isPersonal" = FALSE
   AND array_length("apps", 1) IS NULL;
