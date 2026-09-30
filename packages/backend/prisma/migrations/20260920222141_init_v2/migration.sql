-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'CASEWORKER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ProgramKind" AS ENUM ('PREGNANCY', 'NUTRITION', 'MIDWIFE', 'STUDENT', 'FAMILY_PAF');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('MOTHER', 'CHILD', 'PERSON', 'FAMILY');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('GRADUATED', 'WITHDREW', 'MOVED_AWAY', 'DIED', 'TRANSFERRED', 'AGED_OUT', 'LOST');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('SITE', 'HOME', 'MOBILE_CLINIC');

-- CreateEnum
CREATE TYPE "NutritionalStatus" AS ENUM ('SEVERE', 'MODERATE', 'MILD', 'NORMAL');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('TEXT', 'NUMBER', 'BOOL', 'CHOICE');

-- CreateEnum
CREATE TYPE "PhotoOwnerType" AS ENUM ('VISIT', 'CHILD', 'MOTHER', 'PERSON', 'FAMILY', 'EVENT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "login" TEXT NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CASEWORKER',
    "lang" VARCHAR(5) NOT NULL DEFAULT 'en',
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "name" VARCHAR(256) NOT NULL,
    "birth_date" TIMESTAMP(3),
    "sex" "Sex",
    "community_id" INTEGER,
    "phone" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mothers" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "name" VARCHAR(256) NOT NULL,
    "birth_date" TIMESTAMP(3),
    "community_id" INTEGER,
    "phone" VARCHAR(64),
    "family_id" INTEGER,
    "midwife_id" INTEGER,
    "pregnancies" INTEGER,
    "children_count" INTEGER,
    "breastfed_count" INTEGER,
    "malnutrition_deaths" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mothers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "name" VARCHAR(256) NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "community_id" INTEGER,
    "mother_id" INTEGER,
    "family_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_name" VARCHAR(512),
    "community_id" INTEGER,
    "phone" VARCHAR(64),
    "caretaker2_name" VARCHAR(256),
    "income_sources" TEXT,
    "deaths_notes" TEXT,
    "in_crisis" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "kind" "ProgramKind" NOT NULL,
    "subject_type" "SubjectType" NOT NULL,
    "description" TEXT,
    "min_age_months" INTEGER,
    "max_age_months" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "program_id" INTEGER NOT NULL,
    "mother_id" INTEGER,
    "child_id" INTEGER,
    "person_id" INTEGER,
    "family_id" INTEGER,
    "enrolled_at" DATE NOT NULL,
    "entry_weight" DECIMAL(6,3),
    "entry_photo_id" INTEGER,
    "admission_notes" TEXT,
    "exited_at" DATE,
    "exit_reason" "ExitReason",
    "exit_weight" DECIMAL(6,3),
    "exit_photo_id" INTEGER,
    "exit_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregnancy_enrollment_details" (
    "enrollment_id" INTEGER NOT NULL,
    "due_date" DATE,
    "pregnancy_number" INTEGER,
    "birthing_assistant_id" INTEGER,

    CONSTRAINT "pregnancy_enrollment_details_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "nutrition_enrollment_details" (
    "enrollment_id" INTEGER NOT NULL,
    "length_at_admission" INTEGER,
    "caretaker_name" VARCHAR(256),
    "caretaker_phone" VARCHAR(64),
    "nutritional_status" "NutritionalStatus",

    CONSTRAINT "nutrition_enrollment_details_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "student_enrollment_details" (
    "enrollment_id" INTEGER NOT NULL,
    "school" VARCHAR(256),
    "class_year" VARCHAR(64),

    CONSTRAINT "student_enrollment_details_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "enrollment_id" INTEGER NOT NULL,
    "visit_date" DATE NOT NULL,
    "location_type" "LocationType" NOT NULL,
    "site_id" INTEGER,
    "community_id" INTEGER,
    "recorded_by_id" INTEGER,
    "event_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregnancy_visit_details" (
    "visit_id" INTEGER NOT NULL,
    "weight" DECIMAL(6,3),
    "gestation_months" INTEGER,
    "examination_type_id" INTEGER,

    CONSTRAINT "pregnancy_visit_details_pkey" PRIMARY KEY ("visit_id")
);

-- CreateTable
CREATE TABLE "nutrition_visit_details" (
    "visit_id" INTEGER NOT NULL,
    "weight" DECIMAL(6,3),
    "height" INTEGER,
    "arm_circumference" INTEGER,
    "weight_for_age_z" DECIMAL(5,2),
    "height_for_age_z" DECIMAL(5,2),
    "weight_for_height_z" DECIMAL(5,2),
    "muac_z" DECIMAL(5,2),
    "nutritional_status" "NutritionalStatus",

    CONSTRAINT "nutrition_visit_details_pkey" PRIMARY KEY ("visit_id")
);

-- CreateTable
CREATE TABLE "visit_resources" (
    "visit_id" INTEGER NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(32),

    CONSTRAINT "visit_resources_pkey" PRIMARY KEY ("visit_id","resource_id")
);

-- CreateTable
CREATE TABLE "visit_trainings" (
    "visit_id" INTEGER NOT NULL,
    "training_id" INTEGER NOT NULL,

    CONSTRAINT "visit_trainings_pkey" PRIMARY KEY ("visit_id","training_id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "answer_type" "AnswerType" NOT NULL,
    "choices" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "program_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_set_items" (
    "id" SERIAL NOT NULL,
    "set_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_answers" (
    "visit_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "value_text" TEXT,
    "value_num" DECIMAL(12,3),
    "value_bool" BOOLEAN,

    CONSTRAINT "visit_answers_pkey" PRIMARY KEY ("visit_id","question_id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "hash" VARCHAR(256),
    "extension" VARCHAR(128) NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_attachments" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "owner_type" "PhotoOwnerType" NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "caption" VARCHAR(512),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "photo_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "event_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthing_assistants" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "name" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "birthing_assistants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthing_assistant_communities" (
    "birthing_assistant_id" INTEGER NOT NULL,
    "community_id" INTEGER NOT NULL,

    CONSTRAINT "birthing_assistant_communities_pkey" PRIMARY KEY ("birthing_assistant_id","community_id")
);

-- CreateTable
CREATE TABLE "birthing_assistant_trainings" (
    "birthing_assistant_id" INTEGER NOT NULL,
    "training_id" INTEGER NOT NULL,

    CONSTRAINT "birthing_assistant_trainings_pkey" PRIMARY KEY ("birthing_assistant_id","training_id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "site_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "boundary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "default_unit" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examination_types" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "examination_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_local_id_key" ON "users"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "people_local_id_key" ON "people"("local_id");

-- CreateIndex
CREATE INDEX "people_community_id_idx" ON "people"("community_id");

-- CreateIndex
CREATE UNIQUE INDEX "mothers_local_id_key" ON "mothers"("local_id");

-- CreateIndex
CREATE INDEX "mothers_community_id_idx" ON "mothers"("community_id");

-- CreateIndex
CREATE INDEX "mothers_family_id_idx" ON "mothers"("family_id");

-- CreateIndex
CREATE INDEX "mothers_midwife_id_idx" ON "mothers"("midwife_id");

-- CreateIndex
CREATE UNIQUE INDEX "children_local_id_key" ON "children"("local_id");

-- CreateIndex
CREATE INDEX "children_community_id_idx" ON "children"("community_id");

-- CreateIndex
CREATE INDEX "children_mother_id_idx" ON "children"("mother_id");

-- CreateIndex
CREATE INDEX "children_family_id_idx" ON "children"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "families_local_id_key" ON "families"("local_id");

-- CreateIndex
CREATE INDEX "families_community_id_idx" ON "families"("community_id");

-- CreateIndex
CREATE INDEX "programs_kind_idx" ON "programs"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_local_id_key" ON "enrollments"("local_id");

-- CreateIndex
CREATE INDEX "enrollments_program_id_exited_at_idx" ON "enrollments"("program_id", "exited_at");

-- CreateIndex
CREATE INDEX "enrollments_enrolled_at_idx" ON "enrollments"("enrolled_at");

-- CreateIndex
CREATE INDEX "enrollments_mother_id_idx" ON "enrollments"("mother_id");

-- CreateIndex
CREATE INDEX "enrollments_child_id_idx" ON "enrollments"("child_id");

-- CreateIndex
CREATE INDEX "enrollments_person_id_idx" ON "enrollments"("person_id");

-- CreateIndex
CREATE INDEX "enrollments_family_id_idx" ON "enrollments"("family_id");

-- CreateIndex
CREATE INDEX "pregnancy_enrollment_details_birthing_assistant_id_idx" ON "pregnancy_enrollment_details"("birthing_assistant_id");

-- CreateIndex
CREATE UNIQUE INDEX "visits_local_id_key" ON "visits"("local_id");

-- CreateIndex
CREATE INDEX "visits_enrollment_id_visit_date_idx" ON "visits"("enrollment_id", "visit_date");

-- CreateIndex
CREATE INDEX "visits_visit_date_idx" ON "visits"("visit_date");

-- CreateIndex
CREATE INDEX "visits_site_id_visit_date_idx" ON "visits"("site_id", "visit_date");

-- CreateIndex
CREATE INDEX "visits_event_id_idx" ON "visits"("event_id");

-- CreateIndex
CREATE INDEX "visits_community_id_idx" ON "visits"("community_id");

-- CreateIndex
CREATE INDEX "visits_recorded_by_id_idx" ON "visits"("recorded_by_id");

-- CreateIndex
CREATE INDEX "pregnancy_visit_details_examination_type_id_idx" ON "pregnancy_visit_details"("examination_type_id");

-- CreateIndex
CREATE INDEX "nutrition_visit_details_nutritional_status_idx" ON "nutrition_visit_details"("nutritional_status");

-- CreateIndex
CREATE INDEX "visit_resources_resource_id_idx" ON "visit_resources"("resource_id");

-- CreateIndex
CREATE INDEX "visit_trainings_training_id_idx" ON "visit_trainings"("training_id");

-- CreateIndex
CREATE INDEX "question_sets_program_id_idx" ON "question_sets"("program_id");

-- CreateIndex
CREATE INDEX "question_set_items_question_id_idx" ON "question_set_items"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_set_items_set_id_question_id_key" ON "question_set_items"("set_id", "question_id");

-- CreateIndex
CREATE INDEX "visit_answers_question_id_idx" ON "visit_answers"("question_id");

-- CreateIndex
CREATE INDEX "photo_attachments_owner_type_owner_id_idx" ON "photo_attachments"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "photo_attachments_file_id_idx" ON "photo_attachments"("file_id");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE UNIQUE INDEX "birthing_assistants_local_id_key" ON "birthing_assistants"("local_id");

-- CreateIndex
CREATE INDEX "birthing_assistant_communities_community_id_idx" ON "birthing_assistant_communities"("community_id");

-- CreateIndex
CREATE INDEX "birthing_assistant_trainings_training_id_idx" ON "birthing_assistant_trainings"("training_id");

-- CreateIndex
CREATE INDEX "communities_site_id_idx" ON "communities"("site_id");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mothers" ADD CONSTRAINT "mothers_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mothers" ADD CONSTRAINT "mothers_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mothers" ADD CONSTRAINT "mothers_midwife_id_fkey" FOREIGN KEY ("midwife_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "mothers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "mothers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_entry_photo_id_fkey" FOREIGN KEY ("entry_photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_exit_photo_id_fkey" FOREIGN KEY ("exit_photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_enrollment_details" ADD CONSTRAINT "pregnancy_enrollment_details_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_enrollment_details" ADD CONSTRAINT "pregnancy_enrollment_details_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_enrollment_details" ADD CONSTRAINT "nutrition_enrollment_details_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_details" ADD CONSTRAINT "student_enrollment_details_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_visit_details" ADD CONSTRAINT "pregnancy_visit_details_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_visit_details" ADD CONSTRAINT "pregnancy_visit_details_examination_type_id_fkey" FOREIGN KEY ("examination_type_id") REFERENCES "examination_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_visit_details" ADD CONSTRAINT "nutrition_visit_details_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_resources" ADD CONSTRAINT "visit_resources_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_resources" ADD CONSTRAINT "visit_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_trainings" ADD CONSTRAINT "visit_trainings_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_trainings" ADD CONSTRAINT "visit_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_set_items" ADD CONSTRAINT "question_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_set_items" ADD CONSTRAINT "question_set_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_answers" ADD CONSTRAINT "visit_answers_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_answers" ADD CONSTRAINT "visit_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_attachments" ADD CONSTRAINT "photo_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_communities" ADD CONSTRAINT "birthing_assistant_communities_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_communities" ADD CONSTRAINT "birthing_assistant_communities_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_trainings" ADD CONSTRAINT "birthing_assistant_trainings_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_trainings" ADD CONSTRAINT "birthing_assistant_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
