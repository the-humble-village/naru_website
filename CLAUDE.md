# CLAUDE.md

## Project Overview

NaruProject is a full-stack family health tracking system for community health workers ("Humble Village"). It's a pnpm + Turborepo monorepo with three packages: a shared validation/i18n library, a Hono REST API backend, and a React SPA frontend.

The data model is **program-centric**: people are *enrolled* in *programs*, and every visit is recorded against an enrollment. `Enrollment` is the spine — the only place that knows who is in what, when they joined, when they left, and what they weighed at each end. The full design, including rationale, is in `SCHEMA_V2.md` at the repo root; read it before changing the schema.

## Rearchitecture status — READ THIS FIRST

**The V2 rearchitecture is complete.** Every step of `SCHEMA_V2.md` §13 and `WEB_DESIGN_V2.md` §14 is built: schema, backend, all 14 components, every page in the §3 route map, and both i18n dictionaries. A subject can be enrolled and a visit recorded end to end through the UI.

**Backend:** Services, routes and tests for `program`, `enrollment`, `visit`, `question`, `question_set`, `mother`, `person`, `event`, `photo_attachment` and `report`, plus everything rewritten against V2 (auth, users, files, admin lookups, sites, birthing assistants, families, children, dashboard, search). All twelve answerable `SCHEMA_V2.md` §8 reports are implemented behind `/api/reports`, table + CSV from one query path.

**Web:** `App.tsx` is the full §3 route map with no placeholders left. `PlaceholderPage` still exists but nothing routes to it.

**Known gaps, by design or deferred:**
- **Event attendance** is deferred (`SCHEMA_V2.md` §11), so the mobile-clinics report is served as `available: false` and rendered disabled rather than hidden (§12.8).
- **The program roster derives its stats client-side.** `EnrollmentListItem` carries no `birthDate`, `communityName` or latest visit weight/status, and `GET /enrollments` has no `search` or `orderBy`, so `ProgramRosterPage` fetches the program's enrollments and subjects and joins them in the browser, capped at 20 pages. Adding those fields plus `search`/`orderBy` to the enrollments endpoint would collapse it to one request and remove the cap — worth doing before any program passes ~2000 enrollments.
- `mothersAssigned` (Midwife roster) and `memberCount` (PAF roster) render as `—`; the only sources are per-row endpoints and an N+1 was not worth it.
- **Enum *data* values from reports** (`NutritionalStatus`, `ProgramKind`, chart legends) render as server English, deliberately: translating them would desync the screen from the CSV export.

**Watch out:** `middleware/soft-delete.ts` carries a hand-maintained list of models with a `deletedAt` column. **Add every new soft-deleted model to it** — a model missing from that list silently returns soft-deleted rows from every query.

**Deliberately gone:** `Parent`, `ChildVisit`, `ParentVisit`, `FamilyVisit` and V1's *nine* question/question-set tables, along with their services, routes and pages. Mobile sync is frozen (`/api/sync` removed). Do not reintroduce any of them; see `SCHEMA_V2.md` §9.3 and §11. (V2 replaces those nine with three — `question`, `question_set`, `question_set_item` — which *are* built and are not what this paragraph is about.)

## Monorepo Structure

```
packages/
  shared/src/
    schemas/          # Zod schemas (one file per entity) + index.ts barrel
      enums.ts        # All V2 enums + DateOnlySchema + SUBJECT_FK / KIND_*_DETAIL maps
    health/           # zscore.ts (WHO z-score calculator), who-data.ts
    i18n/             # en.ts, es.ts — t(key, lang) function
    index.ts          # Re-exports everything

  backend/
    prisma/schema.prisma   # Single source of truth for DB schema
    prisma/seed.ts         # The six program rows (npx prisma db seed)
    src/
      index.ts             # Server entrypoint
      app.ts               # Hono app setup, route mounting
      db.ts                # Prisma client singleton
      config.ts            # Env config
      middleware/          # auth.ts (JWT → c.var.user), role.ts, soft-delete.ts
      routes/              # One Hono app per resource, mounted in app.ts
      services/            # All DB queries + business logic (one per resource)
      utils/date.ts        # toDateOnly / toDecimal for @db.Date and Decimal columns
    tests/                 # Vitest, real test DB (naru_test)

  web/src/
    App.tsx                # React Router v6 route definitions
    api/
      client.ts            # Axios instance, JWT interceptor, silent 401 refresh
      [resource].ts        # One file per resource: export const fooApi = { list, fetch, create, ... }
    components/
      index.ts             # Barrel file — keep in sync when adding components
      Layout.tsx           # Nav sidebar shell
      ProtectedRoute.tsx   # Redirects to /login if unauthenticated
      RoleGate.tsx         # Conditionally renders by role
    pages/
      [Name]Page.tsx       # One per route, named + default export
      __tests__/           # Vitest + RTL, one test file per page
    hooks/
    store/auth.ts          # Zustand: user, tokens, role, lang

android/                   # Native Kotlin + Jetpack Compose (frozen — see §11)
```

## Quick Commands

```bash
# Build all packages (shared must build first — Turbo handles this)
pnpm build

# Dev servers (backend :3000, web :5173 with /api proxy)
pnpm dev

# Run tests
pnpm test                        # all packages
pnpm --filter @naru/web test     # web only
pnpm --filter @naru/backend test # backend only

# Run a single test file
cd packages/web && npx vitest run src/pages/__tests__/SomePage.test.tsx

# Prisma
cd packages/backend
npx prisma migrate dev           # create/apply migration
npx prisma generate              # regenerate client after schema change
npx prisma db seed               # (re)create the six program rows
```

The backend test suite resolves its own database URL from your OS username in
`tests/assert-test-database.ts` (`postgresql://$USER@127.0.0.1:5432/naru_test`). It ignores
`.env.test` unless `TEST_DATABASE_URL` is set. To bring `naru_test` up to date:

```bash
DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/naru_test" npx prisma migrate deploy
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Language | TypeScript (strict mode, no `any`) |
| Backend | Hono, Prisma, PostgreSQL 16 |
| Validation | Zod (shared schemas are the single source of truth) |
| Frontend | React 18, Vite, React Router v6, Tailwind CSS |
| Server state | TanStack Query |
| Client state | Zustand (`useAuthStore` with localStorage persistence) |
| Auth | JWT (access 1h + refresh 30d, silent refresh) |
| Testing | Vitest + React Testing Library (jsdom) |
| Monorepo | pnpm workspaces + Turborepo |

## Invariants

- **Soft delete everything** — set `deletedAt`, never hard-delete rows
- **Every model** has `id`, `createdAt`, `updatedAt`, `deletedAt`; syncable models also have `localId`
- **Never expose** `deletedAt` or `passwordHash` in API responses
- **All business logic lives in services**, not route handlers
- **Use Prisma migrations** — never raw SQL or manual ALTER TABLE
- **Validate all input with Zod** — schemas come from `@naru/shared`
- **No `any` types** — use Zod inference (`z.infer<typeof Schema>`)

### V2-specific invariants

- **An enrollment names exactly one subject.** Exactly one of `motherId`/`childId`/`personId`/`familyId` is non-null, enforced by a CHECK constraint. The service layer must also check the populated FK matches `program.subjectType`.
- **A subject can hold only one active enrollment per program** (partial unique indexes). Re-enrolling across years is fine; overlapping is not.
- **`exitedAt` and `exitReason` travel together**, and `exitedAt >= enrolledAt`. Exit is a separate operation from update.
- **Active enrollment** = `exitedAt IS NULL AND deletedAt IS NULL`. **Enrolled on date D** = `enrolledAt <= D AND (exitedAt IS NULL OR exitedAt > D)`.
- **"Unenrolled" is not a flag** — it is zero active enrollment rows. Query with `enrollments: { none: { exitedAt: null, deletedAt: null } }`.
- **`child.motherId` and `child.familyId` are nullable and must stay that way.** A malnourished infant has to be admittable with neither; nothing may block admission.
- **Site is a rollup of Community.** Subjects store only `communityId`; their site is derived via `community.siteId`. Never add a `siteId` to a subject table — two fields could contradict each other.
- **Age at admission is derived** (`enrolledAt - birthDate`), never stored.
- **Z-scores are computed at write time and persisted** on `nutrition_visit_details`, so reports index the enum rather than recalculating WHO tables. All four are live: `who-data.ts` carries weight-for-age, arm-circumference-for-age, length/height-for-age and weight-for-length/height. The one calculation lives in `computeNutritionZScores()` in `@naru/shared` — the backend persists its result and the web renders the live badge from it, so the two can never disagree. It also owns the millimetre→centimetre conversion that `armCircumferenceForAge()` expects.
- **The WHO tables are keyed in the units the database stores.** Age-indexed tables (`WFA_*`, `ACFA_*`, `LHFA_*`) are keyed by age in days; `WFL_*` and `WFH_*` are keyed by **millimetres**, not centimetres, so the key is an integer. WHO publishes two non-interchangeable weight-for-size tables — recumbent length under two years, standing height from two — and `weightForHeight()` switches at 731 days. Picking the wrong one shifts every z-score in the same direction.
- **`nutritionalStatus` follows MUAC-for-age, falling back to weight-for-age** when no arm circumference was taken. MUAC is the WHO measure for the acute malnutrition this programme treats. `classifyZScore`'s `above`/`high` labels both collapse to `NORMAL` — the raw z-scores are persisted, so an overweight report needs no migration.
- **Midwife ≠ birthing assistant.** A midwife is community support for a pregnant woman, modelled as a `Person` in the Midwives program (`mother.midwifeId`). A birthing assistant is a medically-trained professional who attends a birth (`pregnancy_enrollment_details.birthingAssistantId`). Never merge them.
- **`photo_attachment.ownerId` has no FK** — the service must verify the row named by `ownerType` exists. Entry/exit photos are *not* attachments; they are named FK slots on `Enrollment`.
- **A retired question stays in its sets.** Soft-deleting a `Question` leaves its `question_set_item` and `visit_answer` rows intact, so last year's answers stay readable; `question-set.service.ts` filters retired questions out of the items it returns so no new visit form offers them. The soft-delete middleware cannot do this — it only rewrites the top-level `where`, never a nested relation.
- **A question set with a null `programId` applies to every program.** List with `?programId=N&includeShared=true` to get what a visit form should render; without `includeShared` the filter is an exact match, which is what the admin screen wants.

## Program kinds

Five kinds; each may have many admin-created `program` rows. Adding a nutrition variant or a "Formula" programme is a new **row**, not a migration.

| Kind | Subject | Enrollment detail | Visit detail |
|---|---|---|---|
| `PREGNANCY` | `MOTHER` | ✅ | ✅ |
| `NUTRITION` | `CHILD` | ✅ | ✅ |
| `MIDWIFE` | `PERSON` | — | — |
| `STUDENT` | `PERSON` | ✅ | — |
| `FAMILY_PAF` | `FAMILY` | — | — |

Kinds with no detail table record visits purely on the shared `visit` spine (date, location, trainings, resources, answers). `KIND_ENROLLMENT_DETAIL` and `KIND_VISIT_DETAIL` in `@naru/shared` encode which detail table each kind permits.

## Adding New Code

### New entity (end-to-end)

1. **Schema**: `packages/shared/src/schemas/[entity].ts` — define `*CreateSchema`, `*UpdateSchema`, `*ReadSchema` + inferred types. Export from `schemas/index.ts`.
2. **Prisma model**: Add to `prisma/schema.prisma`. Run `npx prisma migrate dev`.
3. **Service**: `packages/backend/src/services/[entity].service.ts` — all DB logic here.
4. **Route**: `packages/backend/src/routes/[entity].ts` — HTTP layer only. Mount in `app.ts`.
5. **Backend test**: `packages/backend/tests/[entity].test.ts`
6. **API client**: `packages/web/src/api/[entity].ts` — export namespace object.
7. **Page**: `packages/web/src/pages/[Name]Page.tsx` — add route in `App.tsx`.
8. **Page test**: `packages/web/src/pages/__tests__/[Name]Page.test.tsx`

## Entity Relationships

```
Program ──< Enrollment ──< Visit
                │            ├── VisitResource >── Resource
                │            ├── VisitTraining >── Training
                │            ├── VisitAnswer   >── Question
                │            ├── PregnancyVisitDetail  (→ ExaminationType)
                │            └── NutritionVisitDetail
                │
                ├─ subject: Mother | Child | Person | Family  (exactly one)
                ├─ entryPhoto / exitPhoto → File
                ├── PregnancyEnrollmentDetail (→ BirthingAssistant)
                ├── NutritionEnrollmentDetail
                └── StudentEnrollmentDetail

Mother  → belongs to Family?, Community?, midwife (Person)?
Child   → belongs to Mother?, Family?, Community?     (all optional)
Person  → belongs to Community?
Family  → belongs to Community?

Community → belongs to Site?          (Site is a rollup of Community)
Event     → has many Visit            (attendance deferred)

PhotoAttachment → polymorphic (ownerType, ownerId), no FK on ownerId

BirthingAssistant ↔ Community (many-to-many via junction)
BirthingAssistant ↔ Training  (many-to-many via junction)

Lookup tables: Community, Site, Resource, Training, ExaminationType
  Admin-managed. Soft-deleted, never hard-deleted.

User (standalone — auth only; referenced by visit.recordedById)
```

Full schema: `packages/backend/prisma/schema.prisma`

## Shared Package (`@naru/shared`)

Exports four things:

1. **Enums & helpers** — every V2 enum, plus `DateOnlySchema` (normalises `@db.Date` values to `YYYY-MM-DD` so a client timezone can't shift the day) and the `SUBJECT_FK` / `KIND_ENROLLMENT_DETAIL` / `KIND_VISIT_DETAIL` maps
2. **Schemas** — Zod schemas per entity with `*CreateSchema`, `*UpdateSchema`, `*ReadSchema` variants and inferred types
3. **Health utils** — `weightForAge()`, `armCircumferenceForAge()`, `classifyZScore()`, `ageInDays()`
4. **i18n** — `t(key, lang)` function with typed keys, English + Spanish dictionaries

After editing shared code, rebuild before using in other packages: `pnpm --filter @naru/shared build`

## Backend Conventions

### Route files (`src/routes/*.ts`)

- One Hono app per resource, mounted in `src/app.ts`
- Middleware chain: `auth` → `requireAdmin`/`requireSupervisor` → handler
- Validation: `zValidator('json', SomeCreateSchema)` then `c.req.valid('json')`
- Response: `c.json(result)` or `c.json(result, 201)`
- List endpoints return `{ items, total, skip, limit }`
- **Resources are top-level, not nested.** `/api/children?familyId=1`, not `/api/families/1/children` — a child can exist with no family, and a nested route cannot address one.

### Service files (`src/services/*.service.ts`)

- All database queries and business logic go here
- Receive validated data, return plain objects
- Throw `HTTPException` for domain errors
- Convert `@db.Date` columns with `toDateOnly()` and `Decimal` columns with `toDecimal()` from `src/utils/date.ts`

### Tests (`tests/*.test.ts`)

- Vitest with a real test PostgreSQL database (`naru_test`)
- Test auth, roles (ADMIN/SUPERVISOR/CASEWORKER), validation, 404s
- `process.env.NODE_ENV = 'test'` set before imports
- `cleanupDatabase()` TRUNCATEs every table before each test, **including `programs`** — so each test creates the programs it needs via `createTestProgram()` rather than relying on the seed
- Helpers in `tests/setup.ts`: `createTestUser`, `createTestFamily`, `createTestMother`, `createTestPerson`, `createTestChild`, `createTestProgram`, `createTestEnrollment`, `createTestVisit`, `createTestCommunity`, `createTestTraining`
- `tests/http.ts` provides `mountRoutes(basePath, routes)` and `tokenFor(user)` — use these in new suites instead of copying the per-file request boilerplate the older suites carry

## Frontend Conventions

### Pages (`src/pages/*.tsx`)

- Functional components with `React.FC`
- Named export + default export
- Data fetching via TanStack Query hooks (`useQuery`, `useMutation`)
- Every page should have a basic render test in `src/pages/__tests__/`

### Components (`src/components/`)

- Barrel file at `components/index.ts` — keep it in sync when adding components
- `ProtectedRoute` wraps authenticated routes (redirects to `/login`)
- `RoleGate` conditionally renders based on user role
- `Layout` is the shell with nav sidebar

### API clients (`src/api/`)

- Axios instance in `client.ts` with token interceptor and 401 redirect
- One file per resource, exports a namespace object: `export const fooApi = { list, fetch, create, ... }`

### State

- **Auth**: `useAuthStore()` (Zustand) — user, tokens, role, lang
- **Server data**: TanStack Query with `['resource', id]` query keys

### Styling

- Tailwind CSS only — no CSS modules or styled-components
- Custom palette: `hv-green`, `hv-green-hover`, `hv-accent`, `hv-crisis`, `hv-gray`, `hv-border`, `hv-card`, `hv-page`
- Defined in `tailwind.config.ts`

### Test patterns (`src/pages/__tests__/*.test.tsx`)

- Mock API modules with `vi.mock('../../api/foo')`
- Mock auth store with `vi.mock('../../store/auth')`
- Wrap with `QueryClientProvider` (retry: false) + `MemoryRouter`
- Use `screen.getByText()`, `waitFor()`, `fireEvent`

## RBAC Roles (highest to lowest)

`ADMIN` > `SUPERVISOR` > `CASEWORKER`

- **Caseworker**: CRUD subjects, enrollments and visits
- **Supervisor**: All caseworker permissions + delete (soft) + manage birthing assistants
- **Admin**: All supervisor permissions + manage users + manage lookup tables and programs

Enforced via middleware: `auth` → `requireRole('supervisor')` in route files.

Roles control what a user can **do**, not what they can **see** — there is no per-user scoping, and all roles see all people. Adding `user_program` / `user_site` scoping later is a pure junction table (`SCHEMA_V2.md` §10).

## Routing (App.tsx)

`App.tsx` is the full `WEB_DESIGN_V2.md` §3 map. A route with no page yet renders `<PlaceholderPage title="…" />` — the route exists so nav and links can be wired ahead of the page; replace the placeholder, don't add a route.

- Public: `/login`
- Protected (any role): `/`, `/programs*`, `/mothers*`, `/children*`, `/people*`, `/families*`, `/unenrolled`, `/enrollments/:id*`, `/visits*`, `/reports*`, `/events*`, `/admin/language`
- Supervisor+: `/admin`, `/admin/birthing-assistants`
- Admin only: `/admin/users`, `/admin/programs`, `/admin/sites`, `/admin/question-sets`, `/admin/:table` (lookup tables)

Real pages today: dashboard, families (list/new/detail), `/children/new`, `/children/:id`, and the admin pages. Everything else is a placeholder.

**Subject routes are flat.** `/children/:id`, never `/families/:id/children/:cid` — a child can exist with no family, so a nested route cannot address one. `AddChildPage` takes an optional `?familyId=` **query** param for the same reason. The V1 nested paths are kept for one release as `RedirectRoute` entries at the bottom of the protected children list; drop them once bookmarks have aged out.

## Reporting queries the model is built for

These are the church's actual questions; keep them answerable when changing the schema (`SCHEMA_V2.md` §8).

- How many people are in programs on date D — single scan of `enrollments`
- Weight on entry and exit, weight and age at graduation — `entry_weight` / `exit_weight` / `exited_at - birth_date`
- Newcomers per month/site — `GROUP BY date_trunc('month', enrolled_at)`
- Attendances and visits per site — `COUNT(visit) GROUP BY program_id, site_id`
- Severe → moderate transitions — consecutive `nutrition_visit_details.nutritional_status` per enrollment
- Kitchen gardens / chickens per site — `visit_resources` with a numeric quantity (this is why resources are rows, not JSON)

Not answerable in V1: mobile clinics and communities per site — needs event attendance (`SCHEMA_V2.md` §11).

## Mobile / Sync

**Frozen.** The Android app is read-only and `/api/sync` has been removed. There is no offline data collection; mountain visits go on paper. `localId` columns are retained on every syncable model so re-enabling needs no migration. When sync returns, the dependency order will be: subjects → enrollment → visit → details.

## Environment Variables

Backend requires (in `packages/backend/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — access token signing key
- `JWT_REFRESH_SECRET` — refresh token signing key
- `PORT` — defaults to 3000
