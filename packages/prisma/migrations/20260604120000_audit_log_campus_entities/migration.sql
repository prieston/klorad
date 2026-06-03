-- Add Campus-app entity types to ActivityEntityType so per-write
-- audit rows can be tagged with the right entity bucket (news /
-- events / clubs / dining / broadcasts / member-overrides).
ALTER TYPE "ActivityEntityType" ADD VALUE 'NEWS_POST';
ALTER TYPE "ActivityEntityType" ADD VALUE 'EVENT_POST';
ALTER TYPE "ActivityEntityType" ADD VALUE 'CLUB';
ALTER TYPE "ActivityEntityType" ADD VALUE 'DINING_LOCATION';
ALTER TYPE "ActivityEntityType" ADD VALUE 'BROADCAST';
ALTER TYPE "ActivityEntityType" ADD VALUE 'PROJECT_MEMBER';
