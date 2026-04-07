-- AlterTable
ALTER TABLE "child_visit_questions" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "family_visit_questions" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "parent_visit_questions" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;
