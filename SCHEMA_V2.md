# Schema V2 — Program-Centric Re-Architecture

**Status:** Steps 1–2 done; step 3 moot (§12.5); steps 4–6 done for `program` and `enrollment`,
plus `mother` and `person` CRUD. `visit` services/routes (§13 steps 4–6) and every web page
(§13 step 7) are still to build.
**Supersedes:** the Family-centric model in `packages/backend/prisma/schema.prisma`
**Source requirements:** `APP-DATA with my notes.md` (Humble Village / church reporting needs)

---

## 1. Why this re-architecture

The current model is **Family-centric**: everything hangs off `Family`, and visits are typed by
*entity* (`ChildVisit`, `ParentVisit`, `FamilyVisit`). The organisation actually operates as a set
of **programs** that people are **enrolled in**, and every reporting question the church asks is
phrased in those terms:

> *"How many people are in programs at date X"* · *"Weight of people on entry and exit"* ·
> *"Weight and age at graduation"* · *"Newcomers per month/site"* · *"Attendances per site"*

None of those are answerable today, because there is no enrollment concept — no admission date, no
exit date, no program.

V2 inverts the model:

```
Program  ──<  Enrollment  ──<  Visit
                  │              │
                  └─ subject: Mother | Child | Person | Family
```

`Enrollment` is the spine. It is the only place that knows *who* is in *what*, *when they joined*,
*when they left*, and *what they weighed at each end*.

---

## 2. Terminology

| Term | Meaning |
|---|---|
| **Program** | An admin-managed row (e.g. "Nutrition Infant <6m"). Has a `kind` and a `subjectType`. |
| **Program kind** | A code-level enum. Determines which typed detail tables apply. 5 kinds. |
| **Subject** | The thing enrolled: a Mother, Child, Person or Family. |
| **Enrollment** | One subject's membership in one program, with entry and exit snapshots. |
| **Visit** | A single encounter recorded against an enrollment. |
| **Midwife** | Community support for a pregnant mother. Modelled as a `Person` in the Midwives program. |
| **Birthing assistant** | A medically-trained professional who attends births. Separate table, not a Person. |

> **Midwife ≠ Birthing assistant.** These are different real-world roles and must not be merged.
> A midwife accompanies a *woman* (`mother.midwifeId`). A birthing assistant attends a *birth*
> (`pregnancy_enrollment_detail.birthingAssistantId`).

---

## 3. Program kinds

Five kinds. Each kind may have many admin-created `program` rows.

| Kind | Subject | Seed program rows | Enrollment detail | Visit detail |
|---|---|---|---|---|
| `PREGNANCY` | `MOTHER` | "Expectant Mother" | ✅ | ✅ |
| `NUTRITION` | `CHILD` | "Nutrition Infant <6m", "Nutrition Child 6m+" | ✅ | ✅ |
| `MIDWIFE` | `PERSON` | "Midwives" | — | — |
| `STUDENT` | `PERSON` | "Youth / Students" | ✅ | — |
| `FAMILY_PAF` | `FAMILY` | "PAF" | — | — |

**Why Nutrition Infant and Nutrition Child are one kind:** the source doc states the child program
is *"same as nutrition infant"* — identical fields. They differ only by age band, so they are two
**rows**, not two kinds. Adding a third nutrition variant needs no migration.

**Why Midwife / Student / PAF have no visit detail:** their visits in the source doc are *only*
date, location, training topic and resources — all of which live on the shared `visit` spine.

**"Family Health" is not a program.** The source doc says it is the training element inside the
nutrition programs. It is a `Training` row, nothing more.

**"Formula" is not currently a program.** If it becomes one, it is a new *row* of the `NUTRITION`
kind — no schema change.

---

## 4. Enums

```prisma
enum Role            { ADMIN SUPERVISOR CASEWORKER }          // unchanged
enum Sex             { MALE FEMALE }                          // unchanged

enum ProgramKind     { PREGNANCY NUTRITION MIDWIFE STUDENT FAMILY_PAF }
enum SubjectType     { MOTHER CHILD PERSON FAMILY }

enum ExitReason      { GRADUATED WITHDREW MOVED_AWAY DIED TRANSFERRED AGED_OUT LOST }
enum LocationType    { SITE HOME MOBILE_CLINIC }
enum NutritionalStatus { SEVERE MODERATE MILD NORMAL }
enum AnswerType      { TEXT NUMBER BOOL CHOICE }
enum PhotoOwnerType  { VISIT CHILD MOTHER PERSON FAMILY EVENT }
```

---

## 5. Conventions (unchanged from V1)

- Every model has `id`, `createdAt`, `updatedAt`, `deletedAt`. **Soft delete only.**
- Syncable models keep `localId String? @unique`. Mobile is frozen for V1 (§11), but the column is
  retained so re-enabling sync in V2 needs no migration.
- Never expose `deletedAt` or `passwordHash` in API responses.
- All business logic in services, not route handlers.
- Zod schemas in `@naru/shared` are the single source of truth for validation.

---

## 6. Models

### 6.1 Subjects

Four subject tables. They are **not** unified under a single `Person` — this was a deliberate
decision so that Mother and Child can grow independent columns over time.

```prisma
model Person {
  id          Int       @id @default(autoincrement())
  localId     String?   @unique @map("local_id")
  name        String    @db.VarChar(256)
  birthDate   DateTime? @map("birth_date")
  sex         Sex?
  communityId Int?      @map("community_id")
  phone       String?   @db.VarChar(64)
  notes       String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  community     Community?   @relation(fields: [communityId], references: [id], onDelete: SetNull)
  enrollments   Enrollment[]
  mothersServed Mother[]     @relation("MotherMidwife")

  @@index([communityId])
  @@map("people")
}
```

`Person` is the subject for the **Midwives** and **Youth/Students** programs.

```prisma
model Mother {
  id                 Int       @id @default(autoincrement())
  localId            String?   @unique @map("local_id")
  name               String    @db.VarChar(256)
  birthDate          DateTime? @map("birth_date")
  communityId        Int?      @map("community_id")
  phone              String?   @db.VarChar(64)
  familyId           Int?      @map("family_id")
  midwifeId          Int?      @map("midwife_id")
  pregnancies        Int?
  childrenCount      Int?      @map("children_count")
  breastfedCount     Int?      @map("breastfed_count")
  malnutritionDeaths Int?      @map("malnutrition_deaths")
  notes              String?   @db.Text
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")

  community   Community?   @relation(fields: [communityId], references: [id], onDelete: SetNull)
  family      Family?      @relation(fields: [familyId], references: [id], onDelete: SetNull)
  midwife     Person?      @relation("MotherMidwife", fields: [midwifeId], references: [id], onDelete: SetNull)
  children    Child[]
  enrollments Enrollment[]

  @@index([communityId])
  @@index([familyId])
  @@index([midwifeId])
  @@map("mothers")
}
```

`midwifeId` is the midwife's **caseload** link — `WHERE midwifeId = :her` returns every mother she
accompanies, including between pregnancies.

`breastfedCount` / `malnutritionDeaths` are plain counts. The source doc's *"were you able to
breastfeed each of them (checkbox)"* is deliberately **not** modelled as per-child rows, because
most of those children will never have a `Child` record.

```prisma
model Child {
  id          Int       @id @default(autoincrement())
  localId     String?   @unique @map("local_id")
  name        String    @db.VarChar(256)
  birthDate   DateTime  @map("birth_date")
  sex         Sex
  communityId Int?      @map("community_id")
  motherId    Int?      @map("mother_id")
  familyId    Int?      @map("family_id")
  notes       String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  community   Community?   @relation(fields: [communityId], references: [id], onDelete: SetNull)
  mother      Mother?      @relation(fields: [motherId], references: [id], onDelete: SetNull)
  family      Family?      @relation(fields: [familyId], references: [id], onDelete: SetNull)
  enrollments Enrollment[]

  @@index([communityId])
  @@index([motherId])
  @@index([familyId])
  @@map("children")
}
```

> **`motherId` is nullable and must stay that way.** A malnourished infant must be admittable with
> no mother record and no family record — nothing may block admission. It is set later if the
> mother is ever enrolled.
>
> This FK is what satisfies the reporting need *"all infants and parents on the incap program
> should be linked together."* Children with a null `motherId` appear in infant counts but not in
> linked-pair counts. That is accepted.

The caretaker who actually brings a child (*"parent/grandparent/other"*) is **free text** on
`nutrition_enrollment_detail.caretakerName`, independent of `motherId`.

**Changes from V1 `Child`:** drops `weight`, `nutritionalState`, `reasonEnrollment`, `dateEntered`,
`photos`. Those move to `Enrollment` (entry snapshot), `nutrition_visit_detail`, and
`photo_attachment` respectively. `familyId` becomes nullable.

```prisma
model Family {
  id              Int       @id @default(autoincrement())
  localId         String?   @unique @map("local_id")
  familyName      String?   @map("family_name") @db.VarChar(512)
  communityId     Int?      @map("community_id")
  phone           String?   @db.VarChar(64)
  caretaker2Name  String?   @map("caretaker2_name") @db.VarChar(256)
  incomeSources   String?   @map("income_sources") @db.Text
  deathsNotes     String?   @map("deaths_notes") @db.Text
  inCrisis        Boolean   @default(false) @map("in_crisis")
  notes           String?   @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  community   Community?   @relation(fields: [communityId], references: [id], onDelete: SetNull)
  mothers     Mother[]
  children    Child[]
  enrollments Enrollment[]

  @@index([communityId])
  @@map("families")
}
```

**Changes from V1 `Family`:** drops `siteId` (now derived via `community.siteId`),
`birthingAssistantId` (moved to pregnancy enrollment), `childrenEditable`, `photos`.

`incomeSources` and `deathsNotes` are free text — neither appears in any current report, and both
are genuinely narrative. Structure them only if a report demands it.

### 6.2 Program & Enrollment

```prisma
model Program {
  id          Int         @id @default(autoincrement())
  name        String      @db.VarChar(256)
  kind        ProgramKind
  subjectType SubjectType @map("subject_type")
  description String?     @db.Text
  active      Boolean     @default(true)
  sortOrder   Int         @default(0) @map("sort_order")
  visitIntervalDays Int?  @map("visit_interval_days") // null = never flag overdue
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  deletedAt   DateTime?   @map("deleted_at")

  enrollments  Enrollment[]
  questionSets QuestionSet[]

  @@index([kind])
  @@map("programs")
}
```

`visitIntervalDays` drives the "overdue" indicator on the program roster and dashboard
(`WEB_DESIGN_V2.md` §4). Nutrition and Pregnancy set it to 30; Midwives, Youth and PAF leave it null.
Added by `20260928030207_add_program_visit_interval`.

`kind` and `subjectType` are immutable after creation — `ProgramUpdateSchema` omits them. Changing
either would leave existing enrollments pointing at the wrong subject FK and detail table. A program
with active enrollments cannot be deleted; set `active = false` to hide it instead.

`subjectType` is redundant with `kind` today (each kind has exactly one subject type), but is stored
explicitly so the API and UI can validate without a hard-coded lookup, and so a future kind could
support a different subject.

```prisma
model Enrollment {
  id        Int @id @default(autoincrement())
  localId   String? @unique @map("local_id")
  programId Int @map("program_id")

  // Exactly one of these four is non-null. Enforced by CHECK constraint (§7.1).
  motherId Int? @map("mother_id")
  childId  Int? @map("child_id")
  personId Int? @map("person_id")
  familyId Int? @map("family_id")

  enrolledAt     DateTime  @map("enrolled_at") @db.Date
  entryWeight    Decimal?  @map("entry_weight") @db.Decimal(6, 3) // kilograms
  entryPhotoId   Int?      @map("entry_photo_id")
  admissionNotes String?   @map("admission_notes") @db.Text

  exitedAt   DateTime?   @map("exited_at") @db.Date
  exitReason ExitReason? @map("exit_reason")
  exitWeight Decimal?    @map("exit_weight") @db.Decimal(6, 3)
  exitPhotoId Int?       @map("exit_photo_id")
  exitNotes  String?     @map("exit_notes") @db.Text

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  program Program @relation(fields: [programId], references: [id])
  mother  Mother? @relation(fields: [motherId], references: [id], onDelete: Cascade)
  child   Child?  @relation(fields: [childId], references: [id], onDelete: Cascade)
  person  Person? @relation(fields: [personId], references: [id], onDelete: Cascade)
  family  Family? @relation(fields: [familyId], references: [id], onDelete: Cascade)

  entryPhoto File? @relation("EntryPhoto", fields: [entryPhotoId], references: [id], onDelete: SetNull)
  exitPhoto  File? @relation("ExitPhoto",  fields: [exitPhotoId],  references: [id], onDelete: SetNull)

  visits            Visit[]
  pregnancyDetail   PregnancyEnrollmentDetail?
  nutritionDetail   NutritionEnrollmentDetail?
  studentDetail     StudentEnrollmentDetail?

  @@index([programId, exitedAt])
  @@index([enrolledAt])
  @@index([motherId])
  @@index([childId])
  @@index([personId])
  @@index([familyId])
  @@map("enrollments")
}
```

> **Why four nullable FKs and not a polymorphic `subjectType` + `subjectId`:**
> all four are *real* foreign keys, so Postgres enforces them. A polymorphic pair has no integrity —
> a deleted mother silently orphans her enrollments. The cost is four columns and one CHECK
> constraint; the benefit is that the census query (*"how many people in programs at date X"*, the
> single most-requested report) is a one-table scan.

**Active enrollment** = `exitedAt IS NULL AND deletedAt IS NULL`.
**Enrolled on date D** = `enrolledAt <= D AND (exitedAt IS NULL OR exitedAt > D)`.

**Age at admission** is derived (`enrolledAt - birthDate`), never stored.

#### Enrollment detail tables

One-to-one with `Enrollment`, keyed by `enrollmentId`. Only three exist — Midwife and PAF
enrollments carry no extra fields.

```prisma
model PregnancyEnrollmentDetail {
  enrollmentId        Int       @id @map("enrollment_id")
  dueDate             DateTime? @map("due_date") @db.Date
  pregnancyNumber     Int?      @map("pregnancy_number")
  birthingAssistantId Int?      @map("birthing_assistant_id")

  enrollment        Enrollment         @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  birthingAssistant BirthingAssistant? @relation(fields: [birthingAssistantId], references: [id], onDelete: SetNull)

  @@map("pregnancy_enrollment_details")
}

model NutritionEnrollmentDetail {
  enrollmentId       Int                @id @map("enrollment_id")
  lengthAtAdmission  Int?               @map("length_at_admission")  // millimetres
  caretakerName      String?            @map("caretaker_name") @db.VarChar(256)
  caretakerPhone     String?            @map("caretaker_phone") @db.VarChar(64)
  nutritionalStatus  NutritionalStatus? @map("nutritional_status")

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@map("nutrition_enrollment_details")
}

model StudentEnrollmentDetail {
  enrollmentId Int     @id @map("enrollment_id")
  school       String? @db.VarChar(256)
  classYear    String? @map("class_year") @db.VarChar(64)

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@map("student_enrollment_details")
}
```

> Weight at admission lives on `enrollment.entryWeight`, **not** in the detail tables. Every program
> that measures uses the same column, so entry-vs-exit weight is one query across all programs.

### 6.3 Visits

```prisma
model Visit {
  id           Int          @id @default(autoincrement())
  localId      String?      @unique @map("local_id")
  enrollmentId Int          @map("enrollment_id")
  visitDate    DateTime     @map("visit_date") @db.Date
  locationType LocationType @map("location_type")
  siteId       Int?         @map("site_id")
  communityId  Int?         @map("community_id")
  recordedById Int?         @map("recorded_by_id")
  eventId      Int?         @map("event_id")
  notes        String?      @db.Text
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  deletedAt    DateTime?    @map("deleted_at")

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  site       Site?      @relation(fields: [siteId], references: [id], onDelete: SetNull)
  community  Community? @relation(fields: [communityId], references: [id], onDelete: SetNull)
  recordedBy User?      @relation(fields: [recordedById], references: [id], onDelete: SetNull)
  event      Event?     @relation(fields: [eventId], references: [id], onDelete: SetNull)

  resources       VisitResource[]
  trainings       VisitTraining[]
  answers         VisitAnswer[]
  pregnancyDetail PregnancyVisitDetail?
  nutritionDetail NutritionVisitDetail?

  @@index([enrollmentId, visitDate])
  @@index([visitDate])
  @@index([siteId, visitDate])
  @@map("visits")
}
```

`siteId` / `communityId` record **where the visit happened**, which may differ from the subject's
home community — a mobile clinic held away from home is counted where it occurred.

`eventId` is nullable and unused in V1 (see §11).

Visit detail tables — only two, because Midwife, Student and PAF visits are pure spine:

```prisma
model PregnancyVisitDetail {
  visitId           Int      @id @map("visit_id")
  weight            Decimal? @db.Decimal(6, 3)      // kilograms
  gestationMonths   Int?     @map("gestation_months")
  examinationTypeId Int?     @map("examination_type_id")

  visit           Visit            @relation(fields: [visitId], references: [id], onDelete: Cascade)
  examinationType ExaminationType? @relation(fields: [examinationTypeId], references: [id], onDelete: SetNull)

  @@map("pregnancy_visit_details")
}

model NutritionVisitDetail {
  visitId          Int      @id @map("visit_id")
  weight           Decimal? @db.Decimal(6, 3)   // kilograms
  height           Int?                          // millimetres
  armCircumference Int?     @map("arm_circumference") // millimetres

  weightForAgeZ     Decimal? @map("weight_for_age_z") @db.Decimal(5, 2)
  heightForAgeZ     Decimal? @map("height_for_age_z") @db.Decimal(5, 2)
  weightForHeightZ  Decimal? @map("weight_for_height_z") @db.Decimal(5, 2)
  muacZ             Decimal? @map("muac_z") @db.Decimal(5, 2)
  nutritionalStatus NutritionalStatus? @map("nutritional_status")

  visit Visit @relation(fields: [visitId], references: [id], onDelete: Cascade)

  @@index([nutritionalStatus])
  @@map("nutrition_visit_details")
}
```

> **Z-scores are computed at write time and persisted.** Reports index the enum instead of
> recalculating WHO tables over the full history, and a visit keeps the classification it was given
> even if WHO reference data is later corrected. Raw z-scores are stored alongside so a child
> improving *within* a band is visible.
>
> Computation uses the existing `@naru/shared/health` helpers (`weightForAge`,
> `armCircumferenceForAge`, `classifyZScore`, `ageInDays`). `heightForAgeZ` and `weightForHeightZ`
> need new WHO reference tables — see §12.

#### Visit join tables

```prisma
model VisitResource {
  visitId    Int     @map("visit_id")
  resourceId Int     @map("resource_id")
  quantity   Decimal @db.Decimal(10, 2)
  unit       String? @db.VarChar(32)

  visit    Visit    @relation(fields: [visitId], references: [id], onDelete: Cascade)
  resource Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@id([visitId, resourceId])
  @@index([resourceId])
  @@map("visit_resources")
}

model VisitTraining {
  visitId    Int @map("visit_id")
  trainingId Int @map("training_id")

  visit    Visit    @relation(fields: [visitId], references: [id], onDelete: Cascade)
  training Training @relation(fields: [trainingId], references: [id], onDelete: Cascade)

  @@id([visitId, trainingId])
  @@index([trainingId])
  @@map("visit_trainings")
}
```

> These replace V1's JSON arrays. The reports *"how many kitchen gardens per site"* and *"how many
> with chickens"* are resource counts — they need real rows with a numeric quantity, not a JSON
> scan over free-text quantities like `"1 bag"` / `"1bag"` / `"one bag"`.

### 6.4 Questions

Replaces nine V1 tables (`ChildVisitQuestion`, `ParentVisitQuestion`, `FamilyVisitQuestion`, three
set tables, three set-item tables) with three. Question sets now attach to a **program**, because
visits are organised by program rather than by entity type.

```prisma
model Question {
  id         Int        @id @default(autoincrement())
  title      String     @db.VarChar(1024)
  answerType AnswerType @map("answer_type")
  choices    Json?      // string[] — only when answerType = CHOICE
  sortOrder  Int        @default(0) @map("sort_order")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")
  deletedAt  DateTime?  @map("deleted_at")

  setItems QuestionSetItem[]
  answers  VisitAnswer[]

  @@map("questions")
}

model QuestionSet {
  id        Int       @id @default(autoincrement())
  name      String    @db.VarChar(256)
  programId Int?      @map("program_id")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  program Program?          @relation(fields: [programId], references: [id], onDelete: Cascade)
  items   QuestionSetItem[]

  @@index([programId])
  @@map("question_sets")
}

model QuestionSetItem {
  id         Int @id @default(autoincrement())
  setId      Int @map("set_id")
  questionId Int @map("question_id")
  sortOrder  Int @default(0) @map("sort_order")

  set      QuestionSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  question Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([setId, questionId])
  @@map("question_set_items")
}

model VisitAnswer {
  visitId    Int      @map("visit_id")
  questionId Int      @map("question_id")
  valueText  String?  @map("value_text") @db.Text
  valueNum   Decimal? @map("value_num") @db.Decimal(12, 3)
  valueBool  Boolean? @map("value_bool")

  visit    Visit    @relation(fields: [visitId], references: [id], onDelete: Cascade)
  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@id([visitId, questionId])
  @@index([questionId])
  @@map("visit_answers")
}
```

Answers move out of JSON into real rows so admin-added questions (*"do you have chickens?"*) are
countable.

### 6.5 Photos

```prisma
model PhotoAttachment {
  id        Int            @id @default(autoincrement())
  fileId    Int            @map("file_id")
  ownerType PhotoOwnerType @map("owner_type")
  ownerId   Int            @map("owner_id")
  caption   String?        @db.VarChar(512)
  sortOrder Int            @default(0) @map("sort_order")
  createdAt DateTime       @default(now()) @map("created_at")
  deletedAt DateTime?      @map("deleted_at")

  file File @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([ownerType, ownerId])
  @@map("photo_attachments")
}
```

Entry and exit photos stay **named FK slots** on `Enrollment` because they are specific, reported-on
artifacts (*"foto on entry and exit with baby"*). Everything else goes here, replacing the `photos`
JSON arrays on V1's `Family`, `Child`, `Parent` and all three visit tables.

`File` is unchanged from V1.

### 6.6 Events

Deliberately minimal for V1. Attendance is deferred (§11).

```prisma
model Event {
  id        Int       @id @default(autoincrement())
  name      String    @db.VarChar(256)
  eventDate DateTime  @map("event_date") @db.Date
  notes     String?   @db.Text
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  visits Visit[]

  @@index([eventDate])
  @@map("events")
}
```

Covers Midwives Day, Fathers Day, Teen activities as a simple log.

### 6.7 Lookups & unchanged models

```prisma
model Community {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  siteId    Int?      @map("site_id")      // NEW
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  site                   Site?                        @relation(fields: [siteId], references: [id], onDelete: SetNull)
  people                 Person[]
  mothers                Mother[]
  children               Child[]
  families               Family[]
  visits                 Visit[]
  birthingAssistantLinks BirthingAssistantCommunity[]

  @@index([siteId])
  @@map("communities")
}

model Resource {
  id          Int       @id @default(autoincrement())
  title       String    @db.VarChar(1024)
  defaultUnit String?   @map("default_unit") @db.VarChar(32)   // NEW — "bag", "litre", "kit"
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  visitLinks VisitResource[]

  @@map("resources")
}

model ExaminationType {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(256)
  sortOrder Int       @default(0) @map("sort_order")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  pregnancyVisits PregnancyVisitDetail[]

  @@map("examination_types")
}
```

**`community.siteId` makes Site a rollup of Community.** Subjects store only `communityId`; their
site is derived. This is why `family.siteId` is dropped — two independent fields could contradict
each other, and the source doc puts Community (never Site) on every profile.

Unchanged from V1: `User`, `File`, `Site`, `Training`, `BirthingAssistant`,
`BirthingAssistantCommunity`, `BirthingAssistantTraining`.

`BirthingAssistant` keeps its communities and trainings junctions. It is **not** merged into
`Person`.

---

## 7. Constraints Prisma cannot express

These require raw SQL in the migration.

### 7.1 Exactly-one subject on enrollment

```sql
ALTER TABLE enrollments
  ADD CONSTRAINT enrollment_exactly_one_subject
  CHECK (num_nonnulls(mother_id, child_id, person_id, family_id) = 1);
```

### 7.2 No duplicate active enrollment in the same program

A subject may be enrolled in the same program many times over the years, but only once at a time.

```sql
CREATE UNIQUE INDEX enrollment_one_active_mother
  ON enrollments (program_id, mother_id)
  WHERE exited_at IS NULL AND deleted_at IS NULL AND mother_id IS NOT NULL;
-- repeat for child_id, person_id, family_id
```

### 7.3 Exit fields are all-or-nothing

```sql
ALTER TABLE enrollments
  ADD CONSTRAINT enrollment_exit_consistent
  CHECK ((exited_at IS NULL AND exit_reason IS NULL)
      OR (exited_at IS NOT NULL AND exit_reason IS NOT NULL));
```

### 7.4 Exit cannot precede entry

```sql
ALTER TABLE enrollments
  ADD CONSTRAINT enrollment_exit_after_entry
  CHECK (exited_at IS NULL OR exited_at >= enrolled_at);
```

### 7.5 Enforced in the service layer (not the DB)

- The populated subject FK **must match** `program.subjectType`.
- The enrollment/visit **detail table must match** `program.kind` — a `PREGNANCY` enrollment may
  only have a `PregnancyEnrollmentDetail`.
- `photo_attachment.ownerId` must exist in the table named by `ownerType` (polymorphic, no FK).

---

## 8. Reporting queries this enables

| Church requirement | How |
|---|---|
| How many people in programs at date D | `enrollments WHERE enrolled_at <= D AND (exited_at IS NULL OR exited_at > D)` |
| Weight on entry and exit | `enrollments.entry_weight`, `exit_weight` |
| Weight and age at graduation | `exit_weight`, `exited_at - birthDate` where `exit_reason = 'GRADUATED'` |
| Infants + mothers linked on incap | `child JOIN mother ON child.mother_id` |
| Severe → moderate transitions per site | consecutive `nutrition_visit_details.nutritional_status` per enrollment, grouped via `community.site_id` |
| Newcomers per month / site | `GROUP BY date_trunc('month', enrolled_at)` |
| Attendances to programs per site | `COUNT(visit) GROUP BY program_id, site_id` |
| Visits per site / total | `COUNT(visit) GROUP BY site_id` |
| Nutritional evaluations per site | `COUNT(nutrition_visit_details) GROUP BY site_id` |
| Home visits per site | `visits WHERE location_type = 'HOME'` |
| Kitchen gardens / chickens per site | `visit_resources JOIN resource WHERE title = ...` |
| Program members by community / age | `enrollments JOIN subject ON community_id`, age from `birth_date` |
| **How many mobile clinics / communities each** | ❌ **not answerable in V1** — needs event attendance (§11) |

---

## 9. Migration plan

### 9.1 Preserved

Admin / lookup data carries over unchanged: `users`, `sites`, `communities`, `resources`,
`training`, `birthing_assistants` and both BA junctions, `files`.

`communities.site_id` is added **nullable**. Every existing community needs a site assigned by an
admin after migration — surface this as an admin to-do.

### 9.2 Migrated

| V1 | V2 | Notes |
|---|---|---|
| `families` | `families` | drop `site_id`, `birthing_assistant_id`, `children_editable`, `photos` |
| `parents` where `role` ≈ mother | `mothers` | `name`, `birth_date`, `notes` |
| `parents` other roles | `people` | needs a manual review pass — `role` is free text |
| `children` | `children` | `mother_id` backfilled from the family's single mother where unambiguous |

`family.birthing_assistant_id` has nowhere to go (it is now per-pregnancy). Export it to a CSV for
staff reference before dropping.

### 9.3 Dropped

- `child_visits`, `parent_visits`, `family_visits` — **all visit history is discarded.**
- All nine question / question-set / set-item tables, including their data.
- `parents` (after splitting into mothers/people).

> Trend reporting restarts from zero. This was accepted deliberately: mapping historical visits onto
> programs that did not exist would require guessing.

### 9.4 No synthetic enrollments

**Migrated profiles arrive with zero enrollments.** Guessing a program from V1 data is unreliable —
a `child` row does not say whether they were nutrition infant or nutrition child, and `parent.role`
is free text.

This is a forcing function, not a gap: because visits attach to enrollments, the first time a worker
sees a migrated person they must choose a real program, a real admission date and a real entry
weight. That is better data than a backfilled guess.

"Unenrolled" needs **no schema support** — it is zero active enrollment rows:

```sql
SELECT * FROM children c
WHERE NOT EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.child_id = c.id AND e.exited_at IS NULL AND e.deleted_at IS NULL
);
```

The UI exposes this as a filter on the people list with an **Enroll in program** action, giving
staff a shrinking worklist. The same view later catches anyone who exits every program.

### 9.5 Seed data

Create the six program rows from §3 as part of the migration.

---

## 10. Access control

**Flat roles for V1 — unchanged from today.** `ADMIN` > `SUPERVISOR` > `CASEWORKER` control what a
user can *do*, not what they can *see*.

Nothing in the requirements asks for per-user scoping. `visit.recordedById` still tracks who did
what. Adding `user_program` or `user_site` scoping later is a pure junction table with no migration
of existing rows — cheap to reverse into.

---

## 11. Deferred to a later version

| Deferred | Consequence in V1 |
|---|---|
| **Event attendance** (`event_attendance`, clinic→visit linkage) | *"How many mobile clinics and how many communities for each per site"* has no data source. `visit.eventId` and `visit.locationType = MOBILE_CLINIC` are in place so the data model can absorb it without migration. |
| **Mobile sync** | Android app is frozen / read-only. No offline data collection; mountain visits go on paper. `localId` columns are retained so re-enabling needs no migration. New sync order will be: subjects → enrollment → visit → details. |
| **Per-user program/site scoping** | All roles see all people. |
| **Structured family income / deaths** | Free text only; not reportable. |
| **Per-child birth history for mothers** | Counts only (`breastfedCount`, `malnutritionDeaths`); cannot correlate breastfeeding with outcomes. |
| **Midwife catchment areas** | Coverage is derived from her assigned mothers' communities; communities with *no* midwife are invisible. |

---

## 12. Open implementation questions

1. **WHO reference data.** ⏳ Still open. `heightForAgeZ` and `weightForHeightZ` columns exist on
   `nutrition_visit_details` but stay **null**: `@naru/shared/health` has only weight-for-age and
   MUAC-for-age. The length/height tables need adding to `who-data.ts` before those two z-scores
   can be computed. `weightForAgeZ` and `muacZ` can be computed today.
2. **Gestation months.** ⏳ Still open with Yvonne. Implemented as a worker-entered
   `Int?` (0–11) on `pregnancy_visit_details`, **not** derived from `dueDate`. If it turns out to be
   derived, the column becomes redundant but needs no migration.
3. **Nutrition age bands.** ✅ Resolved — `minAgeMonths` / `maxAgeMonths` added to `Program`. The
   seed sets 0–6 for "Nutrition Infant <6m" and 6–null for "Nutrition Child 6m+". Advisory only:
   the database never enforces them, so a worker can still admit outside the band.
4. **Location prefill.** ⏳ Still open — a UI concern, deferred with the rest of the visit UI.
5. **`parent.role` mapping.** ➖ Moot for now. V1 was migrated by resetting the database
   (`20260920222141_init_v2` is a fresh init), so no mother/person split was written. This becomes
   live again only if a production V1 database has to be carried forward.

---

## 13. Build order

1. ✅ `@naru/shared` — Zod schemas for all new entities, new enums. (WHO length/height tables
   still outstanding — see §12.1.)
2. ✅ `schema.prisma` + migration (including the raw-SQL constraints in §7) + seed programs.
3. ➖ Data migration script (§9) — moot, the database was reset (§12.5).
4. Services: ✅ `program`, ✅ `enrollment`, ⏳ `visit` and the detail/join writes.
   `mother` and `person` CRUD were also built here: they are the subjects of four of the six
   programs, so nothing could be enrolled without them.
5. ✅ Routes for the above, mounted in `app.ts` (`/api/programs`, `/api/enrollments`,
   `/api/mothers`, `/api/people`). ⏳ `/api/visits`.
6. ✅ Backend tests against `naru_test` for the above. ⏳ visit tests.
7. ⏳ Web API clients, then pages — none started; see `WEB_DESIGN_V2.md` §14.
