-- Manual rollback for 20260609120000_add_mobility.
--
-- ─ Why a sibling file, not a real migration ──────────────────────
-- Prisma only scans `migration.sql` in each timestamped directory,
-- so this file is *ignored* by `prisma migrate deploy` and safe to
-- ship next to its forward counterpart. To run it, apply via psql /
-- `prisma db execute` (see "How to apply" below). Then either:
--   (a) recreate the migration row in `_prisma_migrations` matching
--       the original (so Prisma's lockfile stays consistent), or
--   (b) use `prisma migrate resolve --rolled-back 20260609120000_add_mobility`
--       to officially mark it as undone, then `migrate deploy` will
--       try to re-apply it next time.
-- For an additive-only revert (this one) option (b) is cleaner.
--
-- ─ What it does ──────────────────────────────────────────────────
-- Drops the four Mobility tables + the MobilityAlertKind enum in
-- FK-safe order. Touches **zero existing Campus data**. After this
-- runs the schema looks exactly like it did before
-- 20260609120000_add_mobility was applied.
--
-- ─ How to apply ──────────────────────────────────────────────────
-- 1. Set DIRECT_DATABASE_URL to the same DB the migration was
--    applied to (NOT the prisma:// Accelerate URL — migrations need
--    a direct connection).
-- 2. Run with prisma:
--      pnpm --filter @klorad/prisma prisma db execute \
--        --url "$DIRECT_DATABASE_URL" \
--        --file packages/prisma/migrations/20260609120000_add_mobility/rollback.sql
--    Or via psql:
--      psql "$DIRECT_DATABASE_URL" \
--        -f packages/prisma/migrations/20260609120000_add_mobility/rollback.sql
-- 3. Mark the migration as rolled back so Prisma can re-apply it
--    cleanly later:
--      pnpm --filter @klorad/prisma prisma migrate resolve \
--        --rolled-back 20260609120000_add_mobility
--
-- ─ Order matters ─────────────────────────────────────────────────
-- MobilityAlert + MobilityDeviceStatus have FKs to MobilityDevice.
-- MobilityDevice has an FK to MobilityDataSource.
-- All four FK back to Project (which we do NOT touch).
-- So: drop in dependency order.

DROP TABLE IF EXISTS "MobilityAlert";
DROP TABLE IF EXISTS "MobilityDeviceStatus";
DROP TABLE IF EXISTS "MobilityDevice";
DROP TABLE IF EXISTS "MobilityDataSource";

DROP TYPE IF EXISTS "MobilityAlertKind";
