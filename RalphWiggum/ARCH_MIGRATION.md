> **This is a trimmed version of ARCHITECTURE.md for the backend + web migration only. Android/mobile sections have been removed.**

# HumbleVillage — Post-Migration Architecture

This document describes the final-state architecture after migrating from the legacy PHP system. It is the single source of truth for how the system is built.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend + Web Language | TypeScript (strict) | Shared types between backend and web frontend. |
| Backend | Node.js + Hono | Minimal, explicit, no magic. Native Zod integration for validation + OpenAPI. |
| ORM | Prisma | Schema-as-code. Auto-generated types. Declarative migrations. |
| Database | PostgreSQL 16 | Proven. Supports JSONB for dynamic form data. Keeps existing operational knowledge. |
| Validation (Backend) | Zod (shared package) | Runtime validation + static types from one definition. Used by backend + web. |
| Web Frontend | React 18 + Vite + Tailwind CSS | Standard, well-known, large ecosystem. |
| Auth | JWT (access + refresh tokens) | Stateless. Standard. |
| Web Server State | TanStack Query | Handles caching, loading, error states. No manual API state management. |
| Web Client State | Zustand | Lightweight. Auth state, sync status, online/offline flag. |
| Monorepo | pnpm workspaces + Turborepo | Shared packages for backend + web. |

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
│   │   │   │   └── sync.ts            # POST /sync
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
├── nginx/
│   └── app.conf                       # /api/* → backend:3000, /* → web dist
│
├── turbo.json                         # Turborepo pipeline config
├── pnpm-workspace.yaml
├── package.json                       # Root workspace
├── .gitignore
├── .env.example
├── ARCHITECTURE.md                    # Full architecture document (includes Android)
├── ARCH_MIGRATION.md                  # This file (backend + web only)
└── CCGUIDE.md                         # Claude Code operational guide
```

---

## Data Model (Prisma Schema)

This is the complete database schema. Prisma generates TypeScript types and a query client from this file. All tables use soft deletes except `File` (content-addressed, never deleted).

**DATABASE_URL references:**
- Dev: `postgresql://calebr@127.0.0.1:5432/naru`
- Test: `postgresql://calebr@127.0.0.1:5432/naru_test`

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

### Sync

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /sync | any | Push local creates + pull server changes. |

#### Sync endpoint: `POST /api/sync`

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

#### Sync processing rules

1. **Only accept `"operation": "create"`** from clients. Reject edit/delete with 400.
2. **Process in dependency order** regardless of arrival order:
   - Families -> Parents -> Children -> FamilyVisits -> ChildVisits
3. **Single database transaction.** If any record fails validation, roll back everything and return errors. No partial commits.
4. **Duplicate detection via `localId`.** If a record with that `localId` already exists, return `{ status: "already_exists", serverId: <existing> }` -- do not create a duplicate. This handles retried syncs after dropped connections.
5. **Scoped pull.** `serverChanges` contains only records the requesting user has access to (caseworkers: assigned families only; supervisors+: all). Only records with `updatedAt > lastSyncedAt` are included.
6. **Lookup tables in pull.** All lookup tables are included in every pull (they are small). The client replaces its local lookup data on each sync.
7. **`parentLocalId` resolution.** When a child references a family by `parentLocalId` (because the family was also created offline in the same batch), the sync service resolves it to the real `familyId` after processing the family.

---

## Shared Package (`packages/shared`)

The shared package is the single source of truth for the API contract. Every Zod schema defines both runtime validation and the inferred TypeScript type. The backend and web frontend import from this package directly.

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
  localId: z.string().uuid().optional(), // Set by client for offline-created records
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

This pattern repeats for every entity. The backend validates request bodies against `*CreateSchema` / `*UpdateSchema`. The web frontend uses the inferred `*Read` types for API responses directly -- no manual type sync needed between backend and web.

### WHO Z-Score Calculator

The z-score calculator and WHO LMS data tables live in `packages/shared/src/health/`. The backend imports from here for the `/health/zscore` endpoint. The web frontend can also import directly.

Functions:
- `weightForAge(weightKg, ageDays, sex)` -> z-score or null
- `armCircumferenceForAge(circumferenceCm, ageDays, sex)` -> z-score or null
- `classifyZScore(z)` -> `'severe' | 'moderate' | 'mild' | 'normal' | 'above' | 'high'`
- `ageInDays(birthDate, referenceDate?)` -> number of days

### i18n

Translation strings for English and Spanish live in `packages/shared/src/i18n/`. The web frontend imports from here. The backend does not render UI text -- it returns data, and clients handle display.

---

## Backend Architecture

### Route -> Service separation

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

Standard codes: 400 (bad input), 401 (not authenticated), 403 (wrong role), 404 (not found), 422 (Zod validation -- automatic), 500 (unexpected).

---

## Auth & Security

### JWT strategy

- **Access token**: 15-minute expiry. Contains `{ userId, role, lang }`. Sent as `Authorization: Bearer <token>`.
- **Refresh token**: 30-day expiry. Stored in HTTP-only cookie (web). Used only at `POST /auth/refresh`.
- On 401 response, web client redirects to login.

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

## Testing

### Backend

- **Framework**: Vitest + supertest (or Hono's built-in test client).
- **Test database**: Separate PostgreSQL database (`postgresql://calebr@127.0.0.1:5432/naru_test`), reset between test suites via Prisma `migrate reset`.
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

---

## Deployment

- **Server**: AWS EC2, Ubuntu 24.04 LTS.
- **Reverse proxy**: Nginx on port 80/443.
  - `/api/*` -> Node.js backend on `127.0.0.1:3000`
  - `/*` -> React static build served by Nginx
- **Backend process**: Managed by PM2 or systemd.
- **SSL**: Let's Encrypt via Certbot.
- **Frontend build**: `pnpm --filter web build` -> output served from `/var/www/web/dist`.
- **Secrets**: Environment variables via `/etc/environment` or AWS Secrets Manager.

---

## Conventions & Guardrails

### Always

- Soft delete every record (set `deletedAt`, never hard delete).
- Include `createdAt`, `updatedAt`, `deletedAt` on every model (except File).
- Include `localId` on every model that can be created offline.
- Validate all input with Zod schemas from the shared package (backend + web).
- Keep business logic in services, not routes.
- Use Prisma migrations for every schema change. Never ALTER TABLE manually.
- Run tests before considering any feature complete.
- Use TypeScript strict mode in all TypeScript packages.

### Never

- Hard-delete records from the database.
- Commit `.env` files or secrets.
- Write raw SQL on the backend (use Prisma client or Prisma `$queryRaw` only when absolutely necessary).
- Put business logic in route handlers.
- Use `any` type in TypeScript.
- Modify existing Prisma migration files. Always create a new one.
- Expose `deletedAt` or `passwordHash` in API responses.
- Accept sync operations other than `create` from clients.
- Process sync changes outside a single database transaction.
- Skip `localId` duplicate detection in the sync endpoint.
- Return records outside the requesting user's access scope in sync pulls.
