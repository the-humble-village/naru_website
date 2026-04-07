-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'CASEWORKER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_name" VARCHAR(512),
    "children_editable" INTEGER NOT NULL DEFAULT 0,
    "in_crisis" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "community_id" INTEGER,
    "site_id" INTEGER,
    "birthing_assistant_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_id" INTEGER NOT NULL,
    "name" VARCHAR(256),
    "role" VARCHAR(64),
    "birth_date" TIMESTAMP(3),
    "date_entered" TIMESTAMP(3),
    "photo_id" INTEGER,
    "reason_enroll" VARCHAR(4096),
    "due_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_id" INTEGER NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "date_entered" TIMESTAMP(3),
    "photo_id" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "nutritional_state" VARCHAR(512),
    "reason_enrollment" VARCHAR(4096),
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_visits" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "arm_circumference" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "incap" BOOLEAN NOT NULL DEFAULT false,
    "leche" BOOLEAN NOT NULL DEFAULT false,
    "bags_given" TEXT,
    "recv_any_medicine" TEXT,
    "left_from_prog" TEXT,
    "passed_away" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "child_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_visits" (
    "id" SERIAL NOT NULL,
    "local_id" TEXT,
    "family_id" INTEGER NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "trainings_received" JSONB NOT NULL DEFAULT '[]',
    "resources_received" JSONB NOT NULL DEFAULT '[]',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "family_visits_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "hash" VARCHAR(256) NOT NULL,
    "extension" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
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
CREATE TABLE "child_visit_questions" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "child_visit_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_visit_questions" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parent_visit_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_visit_questions" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "family_visit_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_local_id_key" ON "users"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "families_local_id_key" ON "families"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "parents_local_id_key" ON "parents"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "children_local_id_key" ON "children"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_visits_local_id_key" ON "child_visits"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_visits_local_id_key" ON "family_visits"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "birthing_assistants_local_id_key" ON "birthing_assistants"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_hash_key" ON "files"("hash");

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_visits" ADD CONSTRAINT "child_visits_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_visits" ADD CONSTRAINT "family_visits_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_communities" ADD CONSTRAINT "birthing_assistant_communities_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_communities" ADD CONSTRAINT "birthing_assistant_communities_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_trainings" ADD CONSTRAINT "birthing_assistant_trainings_birthing_assistant_id_fkey" FOREIGN KEY ("birthing_assistant_id") REFERENCES "birthing_assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthing_assistant_trainings" ADD CONSTRAINT "birthing_assistant_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
