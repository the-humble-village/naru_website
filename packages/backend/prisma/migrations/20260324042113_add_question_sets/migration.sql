-- CreateTable
CREATE TABLE "child_visit_question_sets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "child_visit_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_visit_question_set_items" (
    "id" SERIAL NOT NULL,
    "set_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "child_visit_question_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_visit_question_sets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parent_visit_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_visit_question_set_items" (
    "id" SERIAL NOT NULL,
    "set_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "parent_visit_question_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_visit_question_sets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "family_visit_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_visit_question_set_items" (
    "id" SERIAL NOT NULL,
    "set_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "family_visit_question_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "child_visit_question_set_items_set_id_question_id_key" ON "child_visit_question_set_items"("set_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_visit_question_set_items_set_id_question_id_key" ON "parent_visit_question_set_items"("set_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_visit_question_set_items_set_id_question_id_key" ON "family_visit_question_set_items"("set_id", "question_id");

-- AddForeignKey
ALTER TABLE "child_visit_question_set_items" ADD CONSTRAINT "child_visit_question_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "child_visit_question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_visit_question_set_items" ADD CONSTRAINT "child_visit_question_set_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "child_visit_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_visit_question_set_items" ADD CONSTRAINT "parent_visit_question_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "parent_visit_question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_visit_question_set_items" ADD CONSTRAINT "parent_visit_question_set_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "parent_visit_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_visit_question_set_items" ADD CONSTRAINT "family_visit_question_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "family_visit_question_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_visit_question_set_items" ADD CONSTRAINT "family_visit_question_set_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "family_visit_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
