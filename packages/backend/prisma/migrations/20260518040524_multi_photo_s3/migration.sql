-- Step 1: Add new columns to files table (with defaults for existing rows)
ALTER TABLE "files" ADD COLUMN "confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mime_type" VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN "s3_key" VARCHAR(512) NOT NULL DEFAULT '',
ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0;

-- Mark existing files as confirmed and set a placeholder s3_key
UPDATE "files" SET "confirmed" = true, "s3_key" = 'legacy/' || "id" || '.' || "extension";

-- Remove the defaults we only needed for migration
ALTER TABLE "files" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE "files" ALTER COLUMN "s3_key" DROP DEFAULT;

-- Make hash nullable and drop unique constraint
DROP INDEX "files_hash_key";
ALTER TABLE "files" ALTER COLUMN "hash" DROP NOT NULL;

-- Step 2: Add photos JSON column to parents, children, families
ALTER TABLE "parents" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "children" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "families" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';

-- Step 3: Migrate existing photoId data to photos arrays
UPDATE "parents" SET "photos" = jsonb_build_array("photo_id") WHERE "photo_id" IS NOT NULL;
UPDATE "children" SET "photos" = jsonb_build_array("photo_id") WHERE "photo_id" IS NOT NULL;

-- Step 4: Drop FK constraints and old columns
ALTER TABLE "parents" DROP CONSTRAINT "parents_photo_id_fkey";
ALTER TABLE "children" DROP CONSTRAINT "children_photo_id_fkey";
ALTER TABLE "parents" DROP COLUMN "photo_id";
ALTER TABLE "children" DROP COLUMN "photo_id";
