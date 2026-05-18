# HumbleVillage — Post-Migration Architecture

This document describes the final-state architecture after migrating from the legacy PHP system. It is the single source of truth for how the system is built.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend + Web Language | TypeScript (strict) | Shared types between backend and web frontend. |
| Mobile Language | Kotlin | Native Android. Direct access to ConnectionService, camera, and all platform APIs. |
| Backend | Node.js + Hono | Minimal, explicit, no magic. Native Zod integration for validation + OpenAPI. |
| ORM | Prisma | Schema-as-code. Auto-generated types. Declarative migrations. |
| Database | PostgreSQL 16 | Proven. Supports JSONB for dynamic form data. Keeps existing operational knowledge. |
| Validation (Backend) | Zod (shared package) | Runtime validation + static types from one definition. Used by backend + web. |
| Web Frontend | React 18 + Vite + Tailwind CSS | Standard, well-known, large ecosystem. |
| Mobile App | Kotlin + Jetpack Compose | Native Android UI. Built and developed in Android Studio. |
| Mobile Local DB | Room + SQLCipher | Android's standard ORM with encrypted storage for sensitive offline data. |
| Mobile Networking | Retrofit + OkHttp + Moshi | Standard Android HTTP stack with JSON serialization. |
| Mobile DI | Hilt (Dagger) | Standard Android dependency injection. |
| Auth | JWT (access + refresh tokens) | Stateless. Mobile-friendly. Standard. |
| Web Server State | TanStack Query | Handles caching, loading, error states. No manual API state management. |
| Web Client State | Zustand | Lightweight. Auth state, sync status, online/offline flag. |
| Monorepo | pnpm workspaces + Turborepo | Shared packages for backend + web. Android app is a sibling directory with Gradle. |

---

## Monorepo Structure

```
humble-village/
├── packages/
│   ├── shared/                        # Shared types, schemas, constants, utilities
│   │   ├── src/
│   │   │   ├── schemas/               # Zod schemas (one file per entity)
│   │   │   │   ├── user.ts
│   │   │   │   ├── family.ts
│   │   │   │   ├── parent.ts
│   │   │   │   ├── child.ts
│   │   │   │   ├── child-visit.ts
│   │   │   │   ├── family-visit.ts
│   │   │   │   ├── birthing-assistant.ts
│   │   │   │   ├── file.ts
│   │   │   │   ├── lookups.ts         # Community, Site, Resource, Training, Questions
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── sync.ts            # Sync request/response schemas
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── roles.ts           # ADMIN, SUPERVISOR, CASEWORKER
│   │   │   │   └── sync.ts            # Sync statuses, entity dependency order
│   │   │   ├── health/
│   │   │   │   ├── zscore.ts          # WHO z-score calculator (pure functions)
│   │   │   │   └── who-data.ts        # LMS lookup tables (boys/girls, WFA/ACFA)
│   │   │   ├── i18n/
│   │   │   │   ├── en.ts
│   │   │   │   └── es.ts
│   │   │   └── index.ts               # Re-exports everything
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma          # Single source of truth for all data
│   │   ├── src/
│   │   │   ├── index.ts               # Server entrypoint (listen on port)
│   │   │   ├── app.ts                 # Hono app: middleware registration, route mounting
│   │   │   ├── db.ts                  # Prisma client singleton
│   │   │   ├── config.ts              # Environment config (dotenv)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts            # JWT verification → sets c.var.user
│   │   │   │   ├── role.ts            # Role gate: requireRole('admin')
│   │   │   │   └── soft-delete.ts     # Prisma middleware: auto-filter deletedAt IS NULL
│   │   │   ├── routes/                # One file per resource. No business logic here.
│   │   │   │   ├── auth.ts            # POST /login, /register, /refresh
│   │   │   │   ├── users.ts           # GET/PUT users
│   │   │   │   ├── families.ts        # CRUD /families
│   │   │   │   ├── parents.ts         # CRUD /families/:familyId/parents
│   │   │   │   ├── children.ts        # CRUD /families/:familyId/children
│   │   │   │   ├── child-visits.ts    # CRUD /families/:fid/children/:cid/visits
│   │   │   │   ├── family-visits.ts   # CRUD /families/:familyId/visits
│   │   │   │   ├── birthing-assistants.ts
│   │   │   │   ├── admin.ts           # CRUD for all lookup tables
│   │   │   │   ├── files.ts           # POST upload, GET by id
│   │   │   │   ├── dashboard.ts       # GET aggregated data
│   │   │   │   ├── search.ts          # GET /search?q=
│   │   │   │   └── sync.ts            # POST /sync (mobile)
│   │   │   └── services/              # All DB queries and business logic live here.
│   │   │       ├── auth.service.ts
│   │   │       ├── user.service.ts
│   │   │       ├── family.service.ts
│   │   │       ├── parent.service.ts
│   │   │       ├── child.service.ts
│   │   │       ├── child-visit.service.ts
│   │   │       ├── family-visit.service.ts
│   │   │       ├── birthing-assistant.service.ts
│   │   │       ├── admin.service.ts   # Generic CRUD for lookup tables
│   │   │       ├── file.service.ts
│   │   │       ├── dashboard.service.ts
│   │   │       ├── search.service.ts
│   │   │       └── sync.service.ts
│   │   ├── tests/
│   │   │   ├── setup.ts               # Test DB, Prisma client, seed helpers
│   │   │   ├── auth.test.ts
│   │   │   ├── families.test.ts
│   │   │   ├── sync.test.ts
│   │   │   └── ...
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx               # Root component + React Router
│   │   │   ├── api/
│   │   │   │   ├── client.ts         # Axios instance: baseURL, JWT interceptor, 401 handler
│   │   │   │   ├── families.ts
│   │   │   │   ├── children.ts
│   │   │   │   ├── parents.ts
│   │   │   │   ├── visits.ts
│   │   │   │   ├── admin.ts
│   │   │   │   └── ...
│   │   │   ├── components/
│   │   │   │   ├── Layout.tsx        # NavBar (Dashboard, Families, Admin) + page shell
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   ├── RoleGate.tsx      # Conditionally render children based on role
│   │   │   │   ├── SearchBar.tsx     # Global search
│   │   │   │   ├── ZScoreBadge.tsx   # Colored classification badge
│   │   │   │   └── ...
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── SignupPage.tsx
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── FamiliesPage.tsx
│   │   │   │   ├── FamilyDetailPage.tsx
│   │   │   │   ├── ChildDetailPage.tsx
│   │   │   │   ├── ParentDetailPage.tsx
│   │   │   │   ├── AddFamilyPage.tsx
│   │   │   │   ├── AddChildVisitPage.tsx
│   │   │   │   ├── AddFamilyVisitPage.tsx
│   │   │   │   ├── AdminPage.tsx
│   │   │   │   ├── AdminUsersPage.tsx
│   │   │   │   ├── AdminCommunitiesPage.tsx
│   │   │   │   ├── AdminBirthingAssistantsPage.tsx
│   │   │   │   ├── AdminLookupsPage.tsx  # Generic page for sites/resources/training/questions
│   │   │   │   ├── LanguagePage.tsx
│   │   │   │   └── ...
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── ...
│   │   │   ├── store/
│   │   │   │   └── auth.ts           # Zustand: user, token, role, lang
│   │   │   └── utils/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
├── android/                              # Native Kotlin Android app (Android Studio project)
│   ├── app/
│   │   ├── src/main/java/org/humblevillage/
│   │   │   ├── HumbleVillageApp.kt       # Application class (Hilt entry point)
│   │   │   ├── MainActivity.kt
│   │   │   ├── data/
│   │   │   │   ├── local/
│   │   │   │   │   ├── AppDatabase.kt    # Room database (SQLCipher encrypted)
│   │   │   │   │   ├── dao/              # Room DAOs (one per entity)
│   │   │   │   │   │   ├── FamilyDao.kt
│   │   │   │   │   │   ├── ParentDao.kt
│   │   │   │   │   │   ├── ChildDao.kt
│   │   │   │   │   │   ├── ChildVisitDao.kt
│   │   │   │   │   │   ├── FamilyVisitDao.kt
│   │   │   │   │   │   └── LookupDao.kt # Communities, sites, resources, etc.
│   │   │   │   │   └── entity/           # Room entities (one per table)
│   │   │   │   │       ├── FamilyEntity.kt
│   │   │   │   │       ├── ParentEntity.kt
│   │   │   │   │       ├── ChildEntity.kt
│   │   │   │   │       ├── ChildVisitEntity.kt
│   │   │   │   │       ├── FamilyVisitEntity.kt
│   │   │   │   │       └── LookupEntity.kt
│   │   │   │   ├── remote/
│   │   │   │   │   ├── ApiClient.kt      # Retrofit instance + OkHttp with auth interceptor
│   │   │   │   │   ├── AuthInterceptor.kt # Injects JWT, handles 401 → refresh → retry
│   │   │   │   │   ├── api/              # Retrofit interface definitions (one per resource)
│   │   │   │   │   │   ├── AuthApi.kt
│   │   │   │   │   │   ├── FamilyApi.kt
│   │   │   │   │   │   ├── ChildApi.kt
│   │   │   │   │   │   ├── SyncApi.kt
│   │   │   │   │   │   └── ...
│   │   │   │   │   └── dto/              # Data transfer objects (mirror API schemas)
│   │   │   │   │       ├── FamilyDto.kt
│   │   │   │   │       ├── ChildDto.kt
│   │   │   │   │       ├── SyncRequestDto.kt
│   │   │   │   │       ├── SyncResponseDto.kt
│   │   │   │   │       └── ...
│   │   │   │   └── repository/           # Mediates between local DB and remote API
│   │   │   │       ├── FamilyRepository.kt
│   │   │   │       ├── ChildRepository.kt
│   │   │   │       ├── VisitRepository.kt
│   │   │   │       └── ...
│   │   │   ├── sync/
│   │   │   │   ├── SyncManager.kt        # Orchestrates push + pull
│   │   │   │   ├── SyncWorker.kt         # WorkManager worker for background/auto sync
│   │   │   │   └── IdResolver.kt         # Maps localId → serverId after sync
│   │   │   ├── auth/
│   │   │   │   ├── TokenManager.kt       # EncryptedSharedPreferences for token storage
│   │   │   │   └── AuthRepository.kt     # Login, register, refresh
│   │   │   ├── health/
│   │   │   │   ├── ZScoreCalculator.kt   # WHO z-score calculations (port from shared)
│   │   │   │   └── WhoData.kt            # LMS lookup tables
│   │   │   ├── ui/
│   │   │   │   ├── navigation/
│   │   │   │   │   └── NavGraph.kt       # Compose Navigation graph
│   │   │   │   ├── theme/
│   │   │   │   │   ├── Theme.kt          # Material 3 theme with HV color palette
│   │   │   │   │   ├── Color.kt          # HV brand colors
│   │   │   │   │   └── Type.kt
│   │   │   │   ├── screens/              # One composable per screen
│   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   ├── DashboardScreen.kt
│   │   │   │   │   ├── FamiliesScreen.kt
│   │   │   │   │   ├── FamilyDetailScreen.kt
│   │   │   │   │   ├── ChildDetailScreen.kt
│   │   │   │   │   ├── AddChildVisitScreen.kt
│   │   │   │   │   ├── AddFamilyVisitScreen.kt
│   │   │   │   │   └── ...
│   │   │   │   └── components/           # Reusable composables
│   │   │   │       ├── OfflineBanner.kt
│   │   │   │       ├── SyncIndicator.kt
│   │   │   │       ├── ZScoreBadge.kt
│   │   │   │       └── ...
│   │   │   └── util/
│   │   │       ├── ConnectivityObserver.kt  # Network state via ConnectivityManager
│   │   │       └── DateUtils.kt
│   │   ├── src/main/res/                 # Android resources (drawables, strings, etc.)
│   │   └── src/test/                     # Unit tests
│   │       └── java/org/humblevillage/
│   │           ├── sync/
│   │           │   └── SyncManagerTest.kt
│   │           └── health/
│   │               └── ZScoreCalculatorTest.kt
│   ├── build.gradle.kts                  # App-level Gradle config
│   └── gradle/
│
├── nginx/
│   └── app.conf                       # /api/* → backend:3000, /* → web dist
│
├── turbo.json                         # Turborepo pipeline config
├── pnpm-workspace.yaml
├── package.json                       # Root workspace
├── .gitignore
├── .env.example
├── ARCHITECTURE.md                    # This file
└── CCGUIDE.md                         # Claude Code operational guide
```

---

## Data Model (Prisma Schema)

This is the complete database schema. Prisma generates TypeScript types and a query client from this file. All tables use soft deletes except `File` (content-addressed, never deleted).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────
// Enums
// ──────────────────────────────────────

enum Role {
  ADMIN
  SUPERVISOR
  CASEWORKER
}

enum Sex {
  MALE
  FEMALE
}

// ──────────────────────────────────────
// Users & Auth
// ──────────────────────────────────────

model User {
  id           Int       @id @default(autoincrement())
  localId      String?   @unique @map("local_id")
  login        String    @unique
  email        String?
  firstName    String?   @map("first_name")
  lastName     String?   @map("last_name")
  passwordHash String    @map("password_hash")
  role         Role      @default(CASEWORKER)
  lang         String    @default("en") @db.VarChar(5)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  @@map("users")
}

// ──────────────────────────────────────
// Core Entities
// ──────────────────────────────────────

model Family {
  id                  Int       @id @default(autoincrement())
  localId             String?   @unique @map("local_id")
  familyName          String?   @map("family_name") @db.VarChar(512)
  childrenEditable    Int       @default(0) @map("children_editable")
  inCrisis            Boolean   @default(false) @map("in_crisis")
  notes               String?   @db.Text
  communityId         Int?      @map("community_id")
  siteId              Int?      @map("site_id")
  birthingAssistantId Int?      @map("birthing_assistant_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")

  community         Community?         @relation(fields: [communityId], references: [id], onDelete: SetNull)
  site              Site?              @relation(fields: [siteId], references: [id], onDelete: SetNull)
  birthingAssistant BirthingAssistant? @relation(fields: [birthingAssistantId], references: [id], onDelete: SetNull)
  parents           Parent[]
  children          Child[]
  familyVisits      FamilyVisit[]

  @@map("families")
}

model Parent {
  id           Int       @id @default(autoincrement())
  localId      String?   @unique @map("local_id")
  familyId     Int       @map("family_id")
  name         String?   @db.VarChar(256)
  role         String?   @db.VarChar(64) // "mother", "caregiver", etc.
  birthDate    DateTime? @map("birth_date")
  dateEntered  DateTime? @map("date_entered")
  photoId      Int?      @map("photo_id")
  reasonEnroll String?   @map("reason_enroll") @db.VarChar(4096)
  dueDate      DateTime? @map("due_date")
  notes        String?   @db.Text
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  photo  File?  @relation(fields: [photoId], references: [id], onDelete: SetNull)

  @@map("parents")
}

model Child {
  id                Int       @id @default(autoincrement())
  localId           String?   @unique @map("local_id")
  familyId          Int       @map("family_id")
  name              String    @db.VarChar(256)
  birthDate         DateTime  @map("birth_date")
  sex               Sex
  dateEntered       DateTime? @map("date_entered")
  photoId           Int?      @map("photo_id")
  weight            Int       @default(0) // grams
  nutritionalState  String?   @map("nutritional_state") @db.VarChar(512)
  reasonEnrollment  String?   @map("reason_enrollment") @db.VarChar(4096)
  observations      String?   @db.Text
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  family      Family       @relation(fields: [familyId], references: [id], onDelete: Cascade)
  photo       File?        @relation(fields: [photoId], references: [id], onDelete: SetNull)
  childVisits ChildVisit[]

  @@map("children")
}

// ──────────────────────────────────────
// Visits & Health Tracking
// ──────────────────────────────────────

// Merges the legacy "records" and "child_visits" tables into one model.
// All child health data — measurements, nutrition tracking, dynamic
// questions — lives here. Optional fields accommodate both visit types.
model ChildVisit {
  id               Int       @id @default(autoincrement())
  localId          String?   @unique @map("local_id")
  familyId         Int       @map("family_id")
  childId          Int       @map("child_id")
  visitDate        DateTime  @map("visit_date")
  weight           Int       @default(0) // grams
  armCircumference Int       @default(0) @map("arm_circumference") // millimeters
  height           Int       @default(0) // millimeters
  incap            Boolean   @default(false) // gave special drink
  leche            Boolean   @default(false) // drinking milk
  bagsGiven        String?   @map("bags_given")
  recvAnyMedicine  String?   @map("recv_any_medicine")
  leftFromProg     String?   @map("left_from_prog")
  passedAway       String?   @map("passed_away")
  questions        Json      @default("[]") // Array of { questionId, question, answer }
  notes            String?   @db.Text
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")
  deletedAt        DateTime? @map("deleted_at")

  child  Child  @relation(fields: [childId], references: [id], onDelete: Cascade)

  @@map("child_visits")
}

model FamilyVisit {
  id                Int       @id @default(autoincrement())
  localId           String?   @unique @map("local_id")
  familyId          Int       @map("family_id")
  visitDate         DateTime  @map("visit_date")
  trainingsReceived Json      @default("[]") @map("trainings_received") // Array of { id, title }
  resourcesReceived Json      @default("[]") @map("resources_received") // Array of { id, title }
  questions         Json      @default("[]") // Array of { questionId, question, answer }
  notes             String?   @db.Text
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  @@map("family_visits")
}

// ──────────────────────────────────────
// Birthing Assistants
// ──────────────────────────────────────

model BirthingAssistant {
  id                Int       @id @default(autoincrement())
  localId           String?   @unique @map("local_id")
  name              String    @db.VarChar(128)
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  servedCommunities BirthingAssistantCommunity[]
  trainingsReceived BirthingAssistantTraining[]
  families          Family[]

  @@map("birthing_assistants")
}

// Junction table: which communities a BA serves
model BirthingAssistantCommunity {
  birthingAssistantId Int @map("birthing_assistant_id")
  communityId         Int @map("community_id")

  birthingAssistant BirthingAssistant @relation(fields: [birthingAssistantId], references: [id], onDelete: Cascade)
  community         Community         @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@id([birthingAssistantId, communityId])
  @@map("birthing_assistant_communities")
}

// Junction table: what training a BA has received
model BirthingAssistantTraining {
  birthingAssistantId Int @map("birthing_assistant_id")
  trainingId          Int @map("training_id")

  birthingAssistant BirthingAssistant @relation(fields: [birthingAssistantId], references: [id], onDelete: Cascade)
  training          Training          @relation(fields: [trainingId], references: [id], onDelete: Cascade)

  @@id([birthingAssistantId, trainingId])
  @@map("birthing_assistant_trainings")
}

// ──────────────────────────────────────
// Files (Photos)
// ──────────────────────────────────────

// No soft delete. Files are content-addressed and immutable.
model File {
  id        Int      @id @default(autoincrement())
  hash      String   @unique @db.VarChar(256) // SHA-256
  extension String   @db.VarChar(128)
  createdAt DateTime @default(now()) @map("created_at")

  parentPhotos Parent[]
  childPhotos  Child[]

  @@map("files")
}

// ──────────────────────────────────────
// Lookup Tables (Admin-Managed)
// ──────────────────────────────────────

model Community {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  families              Family[]
  birthingAssistantLinks BirthingAssistantCommunity[]

  @@map("communities")
}

model Site {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  families Family[]

  @@map("sites")
}

model Resource {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("resources")
}

model Training {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  birthingAssistantLinks BirthingAssistantTraining[]

  @@map("training")
}

model ChildVisitQuestion {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("child_visit_questions")
}

model ParentVisitQuestion {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("parent_visit_questions")
}

model FamilyVisitQuestion {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(1024)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("family_visit_questions")
}
```

### Entity Relationship Summary

```
User (standalone — auth only)

Family
 ├── has many → Parent (cascade delete)
 ├── has many → Child (cascade delete)
 ├── has many → FamilyVisit (cascade delete)
 ├── belongs to → Community (optional, set null on delete)
 ├── belongs to → Site (optional, set null on delete)
 └── belongs to → BirthingAssistant (optional, set null on delete)

Child
 └── has many → ChildVisit (cascade delete)

Parent / Child
 └── belongs to → File (optional photo, set null on delete)

BirthingAssistant
 ├── many-to-many → Community (via junction table)
 └── many-to-many → Training (via junction table)

Lookup tables (Community, Site, Resource, Training, *VisitQuestion)
 └── Admin-managed. Referenced by core entities. Soft-deleted, never hard-deleted.
```

---

## API Design

Base path: `/api`

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | None | Create account. Returns access + refresh tokens. |
| POST | /auth/login | None | Verify credentials. Returns access + refresh tokens. |
| POST | /auth/refresh | Refresh token | Exchange refresh token for new access token. |

Access tokens: 15-minute expiry. Refresh tokens: 30-day expiry.
Passwords hashed with bcrypt (not SHA-256 as in legacy system).

### Users

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /users | admin | List all users (paginated). |
| GET | /users/me | any | Get current user profile. |
| GET | /users/:id | admin | Get user by ID. |
| PUT | /users/:id | admin | Update user (name, email, role). |
| PATCH | /users/me/language | any | Update own language preference. |

### Families

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /families | any | List families (paginated, filterable). Caseworkers see assigned only. |
| POST | /families | any | Create family. |
| GET | /families/:id | any | Get family with parents, children, community, site, BA. |
| PUT | /families/:id | any | Update family. |
| DELETE | /families/:id | supervisor+ | Soft delete family (cascades to children, parents, visits). |

Query params for GET /families: `?search=`, `?communityId=`, `?inCrisis=`, `?skip=`, `?limit=`

### Parents

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /families/:familyId/parents | any | List parents in family. |
| POST | /families/:familyId/parents | any | Add parent to family. |
| GET | /families/:familyId/parents/:id | any | Get parent detail. |
| PUT | /families/:familyId/parents/:id | any | Update parent. |
| DELETE | /families/:familyId/parents/:id | supervisor+ | Soft delete parent. |

### Children

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /families/:familyId/children | any | List children in family. |
| POST | /families/:familyId/children | any | Add child to family. |
| GET | /families/:familyId/children/:id | any | Get child with latest z-scores. |
| PUT | /families/:familyId/children/:id | any | Update child. |
| DELETE | /families/:familyId/children/:id | supervisor+ | Soft delete child. |

### Child Visits

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /families/:fid/children/:cid/visits | any | List visits (paginated). |
| POST | /families/:fid/children/:cid/visits | any | Create visit. |
| GET | /families/:fid/children/:cid/visits/:id | any | Get visit detail. |
| PUT | /families/:fid/children/:cid/visits/:id | any | Update visit. |

### Family Visits

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /families/:familyId/visits | any | List family visits (paginated). |
| POST | /families/:familyId/visits | any | Create family visit. |
| GET | /families/:familyId/visits/:id | any | Get family visit detail. |
| PUT | /families/:familyId/visits/:id | any | Update family visit. |

### Birthing Assistants

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /birthing-assistants | any | List all BAs with communities and trainings. |
| POST | /birthing-assistants | supervisor+ | Create BA. |
| GET | /birthing-assistants/:id | any | Get BA detail. |
| PUT | /birthing-assistants/:id | supervisor+ | Update BA. |
| DELETE | /birthing-assistants/:id | supervisor+ | Soft delete BA. |

### Admin Lookup Tables

All lookup tables share the same route pattern. The `:table` param is one of: `communities`, `sites`, `resources`, `training`, `child-visit-questions`, `parent-visit-questions`, `family-visit-questions`.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /admin/:table | any | List all entries. |
| POST | /admin/:table | admin | Create entry (title). |
| PUT | /admin/:table/:id | admin | Update entry title. |
| DELETE | /admin/:table/:id | admin | Soft delete entry. |

### Files

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /files | any | Upload file (multipart). Returns file ID + URL. SHA-256 dedup. |
| GET | /files/:id | any | Get file metadata. |
| GET | /files/:id/download | any | Serve file binary. |

### Dashboard

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /dashboard | any | Recent visits, recently updated children, families in crisis. |

### Search

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /search?q= | any | Search across families, parents, children by name. |

### Health

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /health/zscore | any | Compute z-scores from weight/circumference/age/sex. |

### Sync (Mobile)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /sync | any | Push local creates + pull server changes. |

Detailed in the Offline Sync section below.

---

## Shared Package (`packages/shared`)

The shared package is the single source of truth for the API contract. Every Zod schema defines both runtime validation and the inferred TypeScript type. The backend and web frontend import from this package directly.

The Android app cannot import TypeScript. Instead, the Zod schemas serve as the canonical API contract, and the Kotlin DTOs in `android/app/src/main/java/.../data/remote/dto/` mirror them. When a schema changes, the corresponding Kotlin data class must be updated to match. The Zod schemas are the source of truth — Kotlin follows.

### Schema pattern per entity

```typescript
// packages/shared/src/schemas/family.ts
import { z } from 'zod';

export const FamilyCreateSchema = z.object({
  familyName: z.string().max(512).nullish(),
  childrenEditable: z.number().int().min(0).default(0),
  inCrisis: z.boolean().default(false),
  communityId: z.number().int().positive().nullish(),
  siteId: z.number().int().positive().nullish(),
  birthingAssistantId: z.number().int().positive().nullish(),
  notes: z.string().nullish(),
  localId: z.string().uuid().optional(), // Set by mobile client for offline-created records
});

export const FamilyUpdateSchema = FamilyCreateSchema.partial();

export const FamilyReadSchema = z.object({
  id: z.number(),
  localId: z.string().nullable(),
  familyName: z.string().nullable(),
  childrenEditable: z.number(),
  inCrisis: z.boolean(),
  notes: z.string().nullable(),
  communityId: z.number().nullable(),
  siteId: z.number().nullable(),
  birthingAssistantId: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // deletedAt is never exposed to clients
});

// Inferred types — used everywhere, defined once
export type FamilyCreate = z.infer<typeof FamilyCreateSchema>;
export type FamilyUpdate = z.infer<typeof FamilyUpdateSchema>;
export type FamilyRead = z.infer<typeof FamilyReadSchema>;
```

This pattern repeats for every entity. The backend validates request bodies against `*CreateSchema` / `*UpdateSchema`. The web frontend uses the inferred `*Read` types for API responses directly — no manual type sync needed between backend and web.

For the Android app, each Zod schema has a corresponding Kotlin data class:

```kotlin
// android/.../data/remote/dto/FamilyDto.kt
@JsonClass(generateAdapter = true)
data class FamilyReadDto(
    val id: Int,
    val localId: String?,
    val familyName: String?,
    val childrenEditable: Int,
    val inCrisis: Boolean,
    val notes: String?,
    val communityId: Int?,
    val siteId: Int?,
    val birthingAssistantId: Int?,
    val createdAt: String,
    val updatedAt: String,
)

@JsonClass(generateAdapter = true)
data class FamilyCreateDto(
    val familyName: String? = null,
    val childrenEditable: Int = 0,
    val inCrisis: Boolean = false,
    val communityId: Int? = null,
    val siteId: Int? = null,
    val birthingAssistantId: Int? = null,
    val notes: String? = null,
    val localId: String? = null,
)
```

These DTOs are the one place where manual sync with the Zod schemas is required. When a field is added to a Zod schema, the corresponding Kotlin DTO must be updated.

### WHO Z-Score Calculator

The z-score calculator and WHO LMS data tables live in `packages/shared/src/health/`. The backend imports from here for the `/health/zscore` endpoint. The web frontend can also import directly.

The Android app has its own Kotlin implementation in `android/.../health/ZScoreCalculator.kt` ported from the same logic. The WHO LMS data tables are bundled as a JSON asset or Kotlin constants. This duplication is necessary because the Android app cannot import TypeScript, but the logic is pure math and unlikely to change.

Functions:
- `weightForAge(weightKg, ageDays, sex)` → z-score or null
- `armCircumferenceForAge(circumferenceCm, ageDays, sex)` → z-score or null
- `classifyZScore(z)` → `'severe' | 'moderate' | 'mild' | 'normal' | 'above' | 'high'`
- `ageInDays(birthDate, referenceDate?)` → number of days

### i18n

Translation strings for English and Spanish live in `packages/shared/src/i18n/`. The web frontend imports from here. The backend does not render UI text — it returns data, and clients handle display.

The Android app uses standard Android string resources (`res/values/strings.xml` and `res/values-es/strings.xml`) for i18n. The translation keys and values should match the shared package, but they are maintained separately using Android's native localization system. This gives the Android app proper RTL support, pluralization, and system language detection for free.

---

## Backend Architecture

### Route → Service separation

Routes handle HTTP concerns only: parse params, validate body with Zod, call service, return JSON. All database access and business logic lives in service files.

```typescript
// packages/backend/src/routes/families.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { FamilyCreateSchema, FamilyUpdateSchema } from '@humble-village/shared';
import { auth, requireRole } from '../middleware/auth';
import * as familyService from '../services/family.service';

const app = new Hono();

app.get('/', auth, async (c) => {
  const { search, skip, limit, communityId, inCrisis } = c.req.query();
  const user = c.get('user');
  const families = await familyService.list({ search, skip, limit, communityId, inCrisis, user });
  return c.json(families);
});

app.post('/', auth, zValidator('json', FamilyCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const family = await familyService.create(data);
  return c.json(family, 201);
});

// ... etc
export default app;
```

### Soft delete middleware

A Prisma middleware automatically appends `WHERE deleted_at IS NULL` to all `findMany`, `findFirst`, and `findUnique` queries. Explicit `includeDeleted: true` overrides this when needed (e.g., admin audit views).

### Error handling

All service errors throw typed HTTP errors that Hono's error handler catches and serializes:

```typescript
throw new HTTPException(404, { message: 'Family not found' });
throw new HTTPException(403, { message: 'Insufficient permissions' });
```

Standard codes: 400 (bad input), 401 (not authenticated), 403 (wrong role), 404 (not found), 422 (Zod validation — automatic), 500 (unexpected).

---

## Auth & Security

### JWT strategy

- **Access token**: 15-minute expiry. Contains `{ userId, role, lang }`. Sent as `Authorization: Bearer <token>`.
- **Refresh token**: 30-day expiry. Stored in HTTP-only cookie (web) or `EncryptedSharedPreferences` (Android). Used only at `POST /auth/refresh`.
- On 401 response, web client redirects to login. Android `AuthInterceptor` attempts one token refresh and retries the original request before redirecting to the login screen.

### RBAC

Three roles with cascading permissions:

| Permission | Caseworker | Supervisor | Admin |
|-----------|-----------|-----------|-------|
| View assigned families | Yes | Yes | Yes |
| View all families | No | Yes | Yes |
| Create families/children/visits | Yes | Yes | Yes |
| Edit any family | No | Yes | Yes |
| Delete records (soft) | No | Yes | Yes |
| Manage birthing assistants | No | Yes | Yes |
| Manage lookup tables | No | No | Yes |
| Manage users | No | No | Yes |

Enforced at the route level via middleware:

```typescript
app.delete('/:id', auth, requireRole('supervisor'), async (c) => { ... });
```

### Password hashing

bcrypt with cost factor 12. The legacy SHA-256 passwords will be migrated with a one-time rehash script, or re-hashed on first login post-migration.

### Secrets

All secrets (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET) loaded from environment variables via `config.ts`. Never hardcoded. `.env` files never committed.

---

## Offline Sync Architecture (Mobile)

### Core constraint

**Offline mode permits only record creation.** Editing and deleting records that exist on the server is disabled while offline. This eliminates conflict resolution entirely.

### Sync categories

| Category | Entities | Offline create? | Offline read? |
|----------|---------|----------------|---------------|
| **Core data** | Family, Parent, Child, ChildVisit, FamilyVisit | Yes | Yes (local DB) |
| **Lookup tables** | Community, Site, Resource, Training, *VisitQuestion | No (pull-only) | Yes (local DB) |
| **Auth** | User | No | Token cached locally |
| **Files** | File (photos) | Queued for upload | Cached locally |
| **Computed** | Dashboard, Search, Z-Scores | No | Z-scores calculated locally |

### Local database (Room)

The Android app uses Room with SQLCipher for encrypted local storage. Every Room entity includes these sync columns:

```kotlin
// Base columns present on every syncable entity
@ColumnInfo(name = "local_id") val localId: String,        // UUID generated on device. Never changes.
@ColumnInfo(name = "server_id") val serverId: Int?,         // Null until server confirms creation.
@ColumnInfo(name = "sync_status") val syncStatus: String,   // "synced" / "pending" / "failed"
```

Room entities map directly to the server models but include the sync metadata. Example:

```kotlin
@Entity(tableName = "families")
data class FamilyEntity(
    @PrimaryKey val localId: String,       // UUID — the local primary key
    val serverId: Int? = null,
    val syncStatus: String = "pending",
    val familyName: String? = null,
    val childrenEditable: Int = 0,
    val inCrisis: Boolean = false,
    val notes: String? = null,
    val communityId: Int? = null,
    val siteId: Int? = null,
    val birthingAssistantId: Int? = null,
    val createdAt: String,
    val updatedAt: String,
)
```

DAOs use `@Query` annotations for typed database access and return `Flow<List<T>>` for reactive UI updates via Compose.

### Sync endpoint: `POST /api/sync`

**Request:**
```json
{
  "lastSyncedAt": "2025-03-01T10:00:00Z",
  "changes": [
    {
      "entity": "family",
      "operation": "create",
      "localId": "550e8400-e29b-41d4-a716-446655440000",
      "data": { "familyName": "Garcia", "inCrisis": false },
      "changedAt": "2025-03-01T11:30:00Z"
    },
    {
      "entity": "child",
      "operation": "create",
      "localId": "661f9511-f30c-52e5-b827-557766551111",
      "parentLocalId": "550e8400-e29b-41d4-a716-446655440000",
      "data": { "name": "Maria", "birthDate": "2024-01-15", "sex": "FEMALE" },
      "changedAt": "2025-03-01T11:45:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "syncedAt": "2025-03-01T12:00:00Z",
  "results": [
    { "localId": "550e8400-...", "serverId": 142, "status": "created" },
    { "localId": "661f9511-...", "serverId": 89, "status": "created" }
  ],
  "serverChanges": {
    "families": [ ... ],
    "parents": [ ... ],
    "children": [ ... ],
    "childVisits": [ ... ],
    "familyVisits": [ ... ],
    "lookups": {
      "communities": [ ... ],
      "sites": [ ... ],
      "resources": [ ... ],
      "training": [ ... ],
      "childVisitQuestions": [ ... ],
      "parentVisitQuestions": [ ... ],
      "familyVisitQuestions": [ ... ]
    }
  },
  "errors": []
}
```

### Sync processing rules

1. **Only accept `"operation": "create"`** from mobile. Reject edit/delete with 400.
2. **Process in dependency order** regardless of arrival order:
   - Families → Parents → Children → FamilyVisits → ChildVisits
3. **Single database transaction.** If any record fails validation, roll back everything and return errors. No partial commits.
4. **Duplicate detection via `localId`.** If a record with that `localId` already exists, return `{ status: "already_exists", serverId: <existing> }` — do not create a duplicate. This handles retried syncs after dropped connections.
5. **Scoped pull.** `serverChanges` contains only records the requesting user has access to (caseworkers: assigned families only; supervisors+: all). Only records with `updatedAt > lastSyncedAt` are included.
6. **Lookup tables in pull.** All lookup tables are included in every pull (they're small). The mobile app replaces its local lookup data on each sync.
7. **`parentLocalId` resolution.** When a child references a family by `parentLocalId` (because the family was also created offline in the same batch), the sync service resolves it to the real `familyId` after processing the family.

### Post-sync local ID resolution (Android side)

After a successful sync response:
1. For each result, find the local record by `localId`.
2. Set `serverId = result.serverId` and `syncStatus = "synced"`.
3. Update any child records that referenced the `localId` as a foreign key to now use `serverId`.
4. Execute inside a single Room `@Transaction` — not record by record.

### Photo sync

Photos created offline are queued separately. After the main sync completes:
1. Upload each queued photo to `POST /api/files`.
2. On success, update the parent/child record's `photoId` via `PUT` (online-only edit).
3. Failed uploads are retried on next sync cycle.

### Online status detection

Use Android's `ConnectivityManager` with a `NetworkCallback` to observe connectivity changes (wrapped in `ConnectivityObserver.kt` as a Kotlin `Flow<Boolean>`). On offline → online transition:
1. Refresh access token if expired.
2. Trigger sync automatically via `WorkManager` (ensures sync completes even if the app is backgrounded).
3. Show sync progress in the UI (pending count, syncing indicator, success/failure summary).
4. Unlock online-only features only after sync completes.

### Offline-only restrictions

These actions are disabled when offline:
- Editing or deleting any record with a `serverId`
- Printing or exporting reports
- Viewing records outside the local DB
- User management
- Admin lookup table management

A persistent banner is shown: "You are offline — some features are unavailable."

### Token expiry during offline periods

- If access token expires while offline, the app continues to work with local data.
- On reconnection, the OkHttp `AuthInterceptor` attempts a token refresh before syncing.
- If refresh token is also expired (offline > 30 days), the user must log in again. A clear message explains why.
- Tokens are stored in `EncryptedSharedPreferences` (backed by Android Keystore). Never use plain `SharedPreferences` or files for tokens.

---

## Web Frontend Architecture

### Routing

React Router v6 with `createBrowserRouter`. All authenticated routes wrapped in `<ProtectedRoute>`.

| Path | Page | Notes |
|------|------|-------|
| `/login` | LoginPage | |
| `/signup` | SignupPage | |
| `/` | DashboardPage | Recent visits, crisis families |
| `/families` | FamiliesPage | Table with search, pagination |
| `/families/new` | AddFamilyPage | |
| `/families/:id` | FamilyDetailPage | Edit form, parents list, children list, visits |
| `/families/:id/parents/:pid` | ParentDetailPage | |
| `/families/:id/children/:cid` | ChildDetailPage | Z-score badges, visit history |
| `/families/:id/children/:cid/visits/new` | AddChildVisitPage | |
| `/families/:id/visits/new` | AddFamilyVisitPage | |
| `/families/:id/visits/:vid` | FamilyVisitDetailPage | |
| `/admin` | AdminPage | Menu of admin sections |
| `/admin/users` | AdminUsersPage | |
| `/admin/communities` | AdminLookupsPage | Generic, driven by `:table` param |
| `/admin/birthing-assistants` | AdminBirthingAssistantsPage | Custom (multi-select UI) |
| `/admin/sites` | AdminLookupsPage | |
| `/admin/resources` | AdminLookupsPage | |
| `/admin/training` | AdminLookupsPage | |
| `/admin/child-visit-questions` | AdminLookupsPage | |
| `/admin/parent-visit-questions` | AdminLookupsPage | |
| `/admin/family-visit-questions` | AdminLookupsPage | |
| `/admin/language` | LanguagePage | |

### State management

- **Zustand**: Auth state (user, tokens, role, lang).
- **TanStack Query**: All server data. Handles caching, refetching, loading/error states. No API data in Zustand.

### Styling

Tailwind CSS utility classes only. No separate CSS files except a global reset in `index.css`. Use the same color palette as the legacy system, defined as Tailwind custom colors:

```javascript
// tailwind.config.ts — extends theme.colors
colors: {
  hv: {
    green: '#2f4f39',
    'green-hover': '#3d6b4a',
    gray: '#646464',
    page: '#faf7f2',
    card: '#ffffff',
    border: '#e0e0e0',
    'border-input': '#dbdad9',
    crisis: '#c0392b',
    accent: '#637dff',
  }
}
```

---

## Android App Architecture

### Overview

The Android app is a native Kotlin project built in Android Studio using Jetpack Compose for UI. It follows the standard Android architecture pattern: UI (Compose) → ViewModel → Repository → Data Sources (Room + Retrofit).

### Key dependencies

| Library | Purpose |
|---------|---------|
| Jetpack Compose + Material 3 | Declarative UI with HV-branded theme |
| Room + SQLCipher | Encrypted local database for offline data |
| Retrofit + OkHttp + Moshi | HTTP client with JSON serialization |
| Hilt (Dagger) | Dependency injection |
| WorkManager | Reliable background sync (survives app kill) |
| Compose Navigation | Screen routing |
| Kotlin Coroutines + Flow | Async operations and reactive data streams |
| CameraX | Photo capture for child/parent profiles |
| EncryptedSharedPreferences | Secure token storage |

### Data flow

```
Compose Screen
  → observes ViewModel (StateFlow)
    → ViewModel calls Repository
      → Repository reads from Room (offline) or Retrofit (online)
        → Room DAOs return Flow<List<Entity>> for reactive updates
        → Retrofit calls return suspend functions with DTO responses
```

### Offline-first behavior

The Repository layer decides the data source:
- **Read operations**: Always read from Room first. If online and data is stale, fetch from API and update Room.
- **Create operations**: Always write to Room with `syncStatus = "pending"`. SyncManager uploads when online.
- **Edit/delete operations**: Only allowed when online and the record has a `serverId`. Writes go directly to API, then Room is updated with the response.

### Sync via WorkManager

`SyncWorker` extends `CoroutineWorker` and is enqueued by `WorkManager` with:
- **Connectivity constraint**: Only runs when network is available.
- **Retry policy**: Exponential backoff on failure.
- **Unique work**: `enqueueUniqueWork` prevents duplicate sync jobs.

This means sync will complete even if the user closes the app after regaining connectivity.

### Navigation

Compose Navigation with a sealed class for routes:

```kotlin
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Families : Screen("families")
    data class FamilyDetail(val id: Int) : Screen("families/{id}")
    data class ChildDetail(val familyId: Int, val childId: Int) : Screen("families/{familyId}/children/{childId}")
    // ... etc
}
```

All authenticated screens are gated by checking `TokenManager.isLoggedIn()`. Role-based UI visibility checks the stored user role.

### Theming

Material 3 with a custom `HumbleVillageTheme` that maps the existing brand colors:

```kotlin
val HvGreen = Color(0xFF2F4F39)
val HvGreenHover = Color(0xFF3D6B4A)
val HvGray = Color(0xFF646464)
val HvPageBg = Color(0xFFFAF7F2)
val HvCrisis = Color(0xFFC0392B)
val HvAccent = Color(0xFF637DFF)
```

### Future: ConnectionService integration

The app structure supports adding telephony features later. `ConnectionService` requires:
- A `ConnectionService` subclass registered in `AndroidManifest.xml`
- A `PhoneAccount` registered with `TelecomManager`
- `Connection` objects to manage call state

This is native Android API access — no bridges or wrappers needed. The architecture already supports it because the app is fully native Kotlin.

---

## Testing

### Backend

- **Framework**: Vitest + supertest (or Hono's built-in test client).
- **Test database**: Separate PostgreSQL database, reset between test suites via Prisma `migrate reset`.
- **Coverage requirements per route**: happy path, 401 (no auth), 403 (wrong role), 404 (not found), validation error (bad input).
- **Sync endpoint tests must cover**:
  - Valid batch of creates returns correct serverId mappings.
  - Duplicate localId returns `already_exists` without creating a duplicate.
  - Invalid operation type (edit/delete) returns 400.
  - Partial failure: entire transaction rolls back.
  - Scoping: caseworker cannot receive another caseworker's records.
  - Dependency order: child created in same batch as parent resolves correctly.

### Web Frontend

- **Framework**: Vitest + React Testing Library.
- Every page component has a basic render test.
- Form components have submission + validation tests.

### Android

- **Unit tests**: JUnit 5 + MockK. Cover sync logic (push, pull, ID resolution), z-score calculations, and repository logic.
- **UI tests**: Compose Testing (`composeTestRule`). Every screen has a basic render test. Form screens have input + submission tests.
- **Instrumented tests**: Room DAO tests run on a real (in-memory) database to verify queries.

---

## Deployment

- **Server**: AWS EC2, Ubuntu 24.04 LTS.
- **Reverse proxy**: Nginx on port 80/443.
  - `/api/*` → Node.js backend on `127.0.0.1:3000`
  - `/*` → React static build served by Nginx
- **Backend process**: Managed by PM2 or systemd.
- **SSL**: Let's Encrypt via Certbot.
- **Frontend build**: `pnpm --filter web build` → output served from `/var/www/web/dist`.
- **Secrets**: Environment variables via `/etc/environment` or AWS Secrets Manager.
- **Android app**: Built with Gradle. Distributed via Google Play or direct APK sideloading for field testing. Signed release builds generated in Android Studio or CI.

---

## Conventions & Guardrails

### Always

- Soft delete every record (set `deletedAt`, never hard delete).
- Include `createdAt`, `updatedAt`, `deletedAt` on every model (except File).
- Include `localId` on every model that can be created offline.
- Validate all input with Zod schemas from the shared package (backend + web).
- Keep Kotlin DTOs in sync with Zod schemas when API contracts change.
- Keep business logic in services, not routes.
- Use Prisma migrations for every schema change. Never ALTER TABLE manually.
- Use Room migrations for every local schema change on Android.
- Run tests before considering any feature complete.
- Use TypeScript strict mode in all TypeScript packages.

### Never

- Hard-delete records from the database.
- Commit `.env` files, secrets, or signing keystores.
- Write raw SQL on the backend (use Prisma client or Prisma `$queryRaw` only when absolutely necessary).
- Put business logic in route handlers.
- Use `any` type in TypeScript.
- Modify existing Prisma migration files. Always create a new one.
- Expose `deletedAt` or `passwordHash` in API responses.
- Accept sync operations other than `create` from mobile clients.
- Process sync changes outside a single database transaction.
- Skip `localId` duplicate detection in the sync endpoint.
- Allow the Android app to edit/delete a record with a `serverId` while offline.
- Silently drop a `failed` sync record — always surface it to the user.
- Return records outside the requesting user's access scope in sync pulls.
- Store tokens in plain `SharedPreferences` on Android — always use `EncryptedSharedPreferences` backed by Android Keystore.
