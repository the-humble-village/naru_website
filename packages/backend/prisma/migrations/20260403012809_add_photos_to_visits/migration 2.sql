-- AlterTable
ALTER TABLE "child_visits" ADD COLUMN     "photos" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "family_visits" ADD COLUMN     "photos" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "parent_visits" ADD COLUMN     "photos" JSONB NOT NULL DEFAULT '[]';
