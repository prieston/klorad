-- AlterTable
ALTER TABLE "Broadcast"
  ADD COLUMN "opened" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clickToken" TEXT;
