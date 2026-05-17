-- AlterTable
ALTER TABLE "child_visits" ALTER COLUMN "weight" SET DEFAULT 0,
ALTER COLUMN "weight" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "children" ALTER COLUMN "weight" SET DEFAULT 0,
ALTER COLUMN "weight" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "parent_visits" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_id" INTEGER NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trainings_received" JSONB NOT NULL DEFAULT '[]',
    "resources_received" JSONB NOT NULL DEFAULT '[]',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parent_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_visits_local_id_key" ON "parent_visits"("local_id");

-- AddForeignKey
ALTER TABLE "parent_visits" ADD CONSTRAINT "parent_visits_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
