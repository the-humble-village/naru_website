# CLAUDE.md

## Project Overview

NaruProject is a full-stack family health tracking system for community health workers ("Humble Village"). It's a pnpm + Turborepo monorepo with three packages: a shared validation/i18n library, a Hono REST API backend, and a React SPA frontend.

## Monorepo Structure

```
packages/
  shared/src/
    schemas/          # Zod schemas (one file per entity) + index.ts barrel
    constants/        # roles.ts, sync.ts
    health/           # zscore.ts (WHO z-score calculator), who-data.ts
    i18n/             # en.ts, es.ts — t(key, lang) function
    index.ts          # Re-exports everything

  backend/
    prisma/schema.prisma   # Single source of truth for DB schema
    src/
      index.ts             # Server entrypoint
      app.ts               # Hono app setup, route mounting
      db.ts                # Prisma client singleton
      config.ts            # Env config
      middleware/           # auth.ts (JWT → c.var.user), role.ts, soft-delete.ts
      routes/              # One Hono app per resource, mounted in app.ts
      services/            # All DB queries + business logic (one per resource)
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

android/                   # Native Kotlin + Jetpack Compose (separate Gradle build)
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
User (standalone — auth only)

Family
 ├── has many → Parent (cascade delete)
 ├── has many → Child (cascade delete)
 ├── has many → FamilyVisit (cascade delete)
 ├── belongs to → Community (optional, set null on delete)
 ├── belongs to → Site (optional, set null on delete)
 └── belongs to → BirthingAssistant (optional, set null on delete)

Child → has many → ChildVisit (cascade delete)
Parent / Child → belongs to → File (optional photo)

BirthingAssistant ↔ Community (many-to-many via junction)
BirthingAssistant ↔ Training (many-to-many via junction)

Lookup tables: Community, Site, Resource, Training, *VisitQuestion
  Admin-managed. Soft-deleted, never hard-deleted.
```

Full schema: `packages/backend/prisma/schema.prisma`

## Shared Package (`@naru/shared`)

Exports three things:

1. **Schemas** — Zod schemas per entity with `*CreateSchema`, `*UpdateSchema`, `*ReadSchema` variants and inferred types
2. **Health utils** — `weightForAge()`, `armCircumferenceForAge()`, `classifyZScore()`, `ageInDays()`
3. **i18n** — `t(key, lang)` function with typed keys, English + Spanish dictionaries

After editing shared code, rebuild before using in other packages: `pnpm --filter @naru/shared build`

## Backend Conventions

### Route files (`src/routes/*.ts`)

- One Hono app per resource, mounted in `src/index.ts`
- Middleware chain: `auth` → `requireAdmin`/`requireSupervisor` → handler
- Validation: `zValidator('json', SomeCreateSchema)` then `c.req.valid('json')`
- Response: `c.json(result)` or `c.json(result, 201)`
- List endpoints return `{ items, total, skip, limit }`

### Service files (`src/services/*.service.ts`)

- All database queries and business logic go here
- Receive validated data, return plain objects
- Throw `HTTPException` for domain errors

### Tests (`tests/*.test.ts`)

- Vitest with a real test PostgreSQL database (`naru_test`)
- Test auth, roles (ADMIN/SUPERVISOR/CASEWORKER), validation, 404s
- `process.env.NODE_ENV = 'test'` set before imports

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

- **Caseworker**: CRUD own assigned families, children, visits
- **Supervisor**: All caseworker permissions + all families + delete (soft) + manage birthing assistants
- **Admin**: All supervisor permissions + manage users + manage lookup tables

Enforced via middleware: `auth` → `requireRole('supervisor')` in route files.

## Routing (App.tsx)

- Public: `/login`, `/signup`
- Protected (any role): `/`, `/families/**`, `/admin/language`
- Supervisor+: `/admin`, `/admin/birthing-assistants`
- Admin only: `/admin/users`, `/admin/:table` (lookup tables)

## Sync (Mobile)

`POST /api/sync` — offline-created records only (no edit/delete while offline). Processed in dependency order (Family → Parent → Child → Visits) in a single transaction. Duplicate detection via `localId`.

- Syncable entities: `family`, `parent`, `child`, `familyVisit`, `childVisit`, `parentVisit`, `birthingAssistant`
- FKs to records created in the same offline batch are named by localId: `localRefs: { familyId?, parentId?, childId? }` (or legacy `parentLocalId` for the owning family). Resolved against the batch, then the DB, so retries are safe.
- `serverChanges.deleted[]` carries tombstones for soft-deleted records — including lookup rows — since `lastSyncedAt`. Without honouring them a client keeps deleted records forever.

See `packages/backend/src/services/sync.service.ts` and `packages/shared/src/schemas/sync.ts` for details, and ARCHITECTURE.md § Mobile Sync Flow for the client contract.

## Environment Variables

Backend requires (in `packages/backend/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — access token signing key
- `JWT_REFRESH_SECRET` — refresh token signing key
- `PORT` — defaults to 3000

