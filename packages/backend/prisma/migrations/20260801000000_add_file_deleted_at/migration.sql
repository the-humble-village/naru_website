-- Bring File under the soft-delete invariant so photos can be removed without
-- destroying the row (and without orphaning audit history).
ALTER TABLE "files" ADD COLUMN "deleted_at" TIMESTAMP(3);
