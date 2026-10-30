-- Integrity rules for `enrollments` that the Prisma schema language cannot express.
-- See SCHEMA_V2.md §7.

-- §7.1 Exactly one subject. The four FKs are real foreign keys precisely so that
-- Postgres enforces them; this constraint is what makes the set behave as a union.
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollment_exactly_one_subject"
  CHECK (num_nonnulls("mother_id", "child_id", "person_id", "family_id") = 1);

-- §7.3 Exit fields are all-or-nothing.
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollment_exit_consistent"
  CHECK (("exited_at" IS NULL AND "exit_reason" IS NULL)
      OR ("exited_at" IS NOT NULL AND "exit_reason" IS NOT NULL));

-- §7.4 Exit cannot precede entry.
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollment_exit_after_entry"
  CHECK ("exited_at" IS NULL OR "exited_at" >= "enrolled_at");

-- §7.2 A subject may be enrolled in the same program many times over the years,
-- but only once at a time. Partial unique indexes, one per subject column.
CREATE UNIQUE INDEX "enrollment_one_active_mother"
  ON "enrollments" ("program_id", "mother_id")
  WHERE "exited_at" IS NULL AND "deleted_at" IS NULL AND "mother_id" IS NOT NULL;

CREATE UNIQUE INDEX "enrollment_one_active_child"
  ON "enrollments" ("program_id", "child_id")
  WHERE "exited_at" IS NULL AND "deleted_at" IS NULL AND "child_id" IS NOT NULL;

CREATE UNIQUE INDEX "enrollment_one_active_person"
  ON "enrollments" ("program_id", "person_id")
  WHERE "exited_at" IS NULL AND "deleted_at" IS NULL AND "person_id" IS NOT NULL;

CREATE UNIQUE INDEX "enrollment_one_active_family"
  ON "enrollments" ("program_id", "family_id")
  WHERE "exited_at" IS NULL AND "deleted_at" IS NULL AND "family_id" IS NOT NULL;
