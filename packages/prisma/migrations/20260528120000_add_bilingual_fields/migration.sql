-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN "titleEl" TEXT;
ALTER TABLE "NewsPost" ADD COLUMN "bodyEl" TEXT;

-- AlterTable
ALTER TABLE "EventPost" ADD COLUMN "titleEl" TEXT;
ALTER TABLE "EventPost" ADD COLUMN "descriptionEl" TEXT;

-- AlterTable
ALTER TABLE "Club" ADD COLUMN "nameEl" TEXT;
ALTER TABLE "Club" ADD COLUMN "descriptionEl" TEXT;

-- AlterTable
ALTER TABLE "DiningLocation" ADD COLUMN "nameEl" TEXT;
ALTER TABLE "DiningLocation" ADD COLUMN "descriptionEl" TEXT;
