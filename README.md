# HumbleVillage (NaruProject)

A full-stack family health tracking system for community health workers. Built as a pnpm + Turborepo monorepo.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagrams.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all dev servers (backend :3000, web :5173)
pnpm dev

# Run all tests
pnpm test

# Build all packages
pnpm build
```

### Backend setup

```bash
# Create packages/backend/.env with:
DATABASE_URL=postgresql://user:pass@localhost:5432/naru
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3000

# Run migrations and generate Prisma client
cd packages/backend
npx prisma migrate dev
npx prisma generate
```

---

## Repository Structure

```
HumbleVillageWebAppOpen/
├── packages/
│   ├── shared/          # @naru/shared — schemas, health utils, i18n
│   ├── backend/         # @naru/backend — Hono REST API + Prisma
│   └── web/             # @naru/web — React SPA
├── android/             # Native Android app (Kotlin + Jetpack Compose)
├── ARCHITECTURE.md      # System diagrams (Mermaid)
├── README.md            # This file
├── pnpm-workspace.yaml
└── turbo.json
```

---

## packages/shared

Shared TypeScript library consumed by both backend and web. Must be built before dependent packages: `pnpm --filter @naru/shared build`.

```
packages/shared/src/
├── index.ts                    # Root barrel — re-exports everything
├── schemas/
│   ├── index.ts                # Barrel for all schemas
│   ├── user.ts                 # UserCreateSchema, UserUpdateSchema, UserReadSchema
│   ├── family.ts               # FamilyCreateSchema, FamilyUpdateSchema, FamilyReadSchema
│   ├── child.ts                # ChildCreateSchema, ChildUpdateSchema, ChildReadSchema
│   ├── parent.ts               # ParentCreateSchema, ParentUpdateSchema, ParentReadSchema
│   ├── child-visit.ts          # ChildVisitCreateSchema, ChildVisitUpdateSchema, ChildVisitReadSchema
│   ├── family-visit.ts         # FamilyVisitCreateSchema, FamilyVisitUpdateSchema, FamilyVisitReadSchema
│   ├── birthing-assistant.ts   # BirthingAssistantCreateSchema, ...ReadSchema
│   ├── file.ts                 # FileReadSchema
│   ├── lookups.ts              # Schemas for Community, Resource, Training, Site
│   ├── dashboard.ts            # DashboardReadSchema (summary stats shape)
│   ├── sync.ts                 # SyncRequestSchema, SyncResponseSchema
│   ├── search.ts               # SearchResultSchema
│   ├── health.ts               # Health classification input/output schemas
│   └── question-sets.ts        # QuestionSet schemas for child/parent/family visits
├── health/
│   ├── zscore.ts               # weightForAge(), armCircumferenceForAge(), classifyZScore(), ageInDays()
│   └── who-data.ts             # WHO reference tables used by zscore.ts
├── i18n/
│   ├── en.ts                   # English translation dictionary
│   ├── es.ts                   # Spanish translation dictionary
│   └── index.ts                # t(key, lang) typed translation function
└── constants/
    ├── roles.ts                # RBAC role constants and hierarchy helpers
    └── sync.ts                 # Sync-related constants
```

**Key conventions:**
- Every entity has three schema variants: `*CreateSchema` (input), `*UpdateSchema` (partial input), `*ReadSchema` (API response shape)
- Use `z.infer<typeof SomeReadSchema>` for types — no manual interfaces
- After editing, rebuild: `pnpm --filter @naru/shared build`

---

## packages/backend

Hono REST API server with Prisma ORM targeting PostgreSQL.

```
packages/backend/
├── prisma/
│   ├── schema.prisma           # Single source of truth for DB schema — all models defined here
│   └── migrations/             # Auto-generated Prisma migration files
├── src/
│   ├── index.ts                # Server entrypoint — calls serve() with the Hono app on $PORT
│   ├── app.ts                  # Hono app setup: mounts all routes under /api, configures CORS + error handler
│   ├── db.ts                   # Prisma client singleton (import this everywhere, don't instantiate your own)
│   ├── config.ts               # Reads and validates env vars (DATABASE_URL, JWT_SECRET, PORT, etc.)
│   ├── middleware/
│   │   ├── auth.ts             # auth() — verifies JWT, sets c.var.user; optionalAuth() — same but non-blocking
│   │   ├── role.ts             # requireRole(role) factory, requireAdmin, requireSupervisor, requireCaseworker
│   │   └── soft-delete.ts      # Prisma middleware that auto-filters deletedAt on reads and converts deletes to soft-deletes
│   ├── routes/
│   │   ├── auth.ts             # POST /api/auth/login, /register, /refresh — no auth required
│   │   ├── families.ts         # CRUD /api/families and /api/families/:id
│   │   ├── children.ts         # CRUD /api/families/:familyId/children and /:id
│   │   ├── parents.ts          # CRUD /api/families/:familyId/parents and /:id
│   │   ├── child-visits.ts     # CRUD /api/families/:fid/children/:cid/visits and /:id
│   │   ├── family-visits.ts    # CRUD /api/families/:familyId/visits and /:id
│   │   ├── birthing-assistants.ts  # CRUD /api/birthing-assistants — SUPERVISOR+ only
│   │   ├── users.ts            # CRUD /api/users — ADMIN only
│   │   ├── admin.ts            # CRUD /api/admin/:table (lookup tables) — ADMIN only
│   │   ├── dashboard.ts        # GET /api/dashboard — aggregate stats for the dashboard
│   │   ├── health.ts           # Health utility endpoints (z-score calculations)
│   │   ├── search.ts           # GET /api/search?q= — full-text search across families/children
│   │   ├── files.ts            # POST /api/files (upload), GET /api/files/:id (download)
│   │   ├── question-sets.ts    # CRUD /api/question-sets — ADMIN only
│   │   ├── sites.ts            # CRUD /api/sites — ADMIN only
│   │   ├── sync.ts             # POST /api/sync — mobile offline sync endpoint
│   │   └── seed.ts             # POST /api/seed — generate test data (dev/staging only)
│   └── services/
│       ├── auth.service.ts             # register(), login(), refresh() — password hashing, token generation
│       ├── family.service.ts           # list(), fetch(), create(), update(), softDelete()
│       ├── child.service.ts            # list(), fetch(), create(), update(), softDelete()
│       ├── parent.service.ts           # list(), fetch(), create(), update(), softDelete()
│       ├── child-visit.service.ts      # list(), fetch(), create(), update()
│       ├── family-visit.service.ts     # list(), fetch(), create(), update()
│       ├── birthing-assistant.service.ts  # CRUD + community/training associations
│       ├── user.service.ts             # list(), fetch(), create(), update(), softDelete()
│       ├── admin.service.ts            # Generic CRUD for lookup tables (Community, Resource, Training)
│       ├── dashboard.service.ts        # getSummary() — aggregate counts and recent activity
│       ├── search.service.ts           # search(query) — cross-entity full-text search
│       ├── file.service.ts             # uploadFile(), getFile() — content-addressed by SHA-256 hash
│       ├── question-set.service.ts     # CRUD for question sets and their items
│       ├── site.service.ts             # CRUD for sites with geo boundary support
│       ├── sync.service.ts             # processSync() — upserts offline records in dependency order
│       └── seed.service.ts             # generateTestData() — creates realistic dummy data
└── tests/
    ├── auth.test.ts
    ├── families.test.ts
    ├── children.test.ts
    ├── parents.test.ts
    ├── child-visits.test.ts
    ├── family-visits.test.ts
    ├── users.test.ts
    ├── birthing-assistants.test.ts
    ├── search.test.ts
    ├── sync.test.ts
    └── ...
```

**Key conventions:**
- Route handlers are thin HTTP layer only — no business logic
- All DB queries and domain logic live in `services/*.service.ts`
- Middleware chain: `auth` → `requireRole(...)` → handler
- Use `zValidator('json', Schema)` for input validation in routes, then `c.req.valid('json')`
- List responses always return `{ items, total, skip, limit }`
- Throw `HTTPException` from services for domain errors
- Never expose `deletedAt` or `passwordHash` in responses

---

## packages/web

React SPA built with Vite.

```
packages/web/src/
├── main.tsx                    # React DOM entry point — mounts <App /> with QueryClientProvider
├── App.tsx                     # React Router v6 route definitions — all routes live here
├── api/
│   ├── client.ts               # Axios instance configured with /api base URL, JWT Authorization header interceptor, silent 401 refresh logic
│   ├── auth.ts                 # authApi.login(), .register(), .refresh()
│   ├── families.ts             # familiesApi.list(), .fetch(), .create(), .update(), .delete()
│   ├── children.ts             # childrenApi.list(), .fetch(), .create(), .update(), .delete()
│   ├── parents.ts              # parentsApi.list(), .fetch(), .create(), .update(), .delete()
│   ├── visits.ts               # childVisitsApi and familyVisitsApi — list, fetch, create, update
│   ├── users.ts                # usersApi — ADMIN user management calls
│   ├── birthing-assistants.ts  # birthingAssistantsApi CRUD
│   ├── admin.ts                # adminApi — generic lookup table CRUD calls
│   ├── dashboard.ts            # dashboardApi.getSummary()
│   ├── search.ts               # searchApi.search(query)
│   ├── files.ts                # filesApi.upload(file), .getUrl(id)
│   ├── question-sets.ts        # questionSetsApi CRUD
│   ├── sites.ts                # sitesApi CRUD
│   └── seed.ts                 # seedApi.generate() — triggers test data generation
├── components/
│   ├── index.ts                # Barrel — import all components from here
│   ├── Layout.tsx              # App shell with nav sidebar; wraps all authenticated pages
│   ├── ProtectedRoute.tsx      # Redirects unauthenticated users to /login
│   ├── RoleGate.tsx            # Conditionally renders children based on user role(s)
│   ├── SearchBar.tsx           # Global search input — navigates to search results
│   ├── MapPicker.tsx           # Interactive map for picking site geo boundaries
│   ├── ZScoreBadge.tsx         # Renders WHO nutritional status badge from z-score
│   └── ui/
│       ├── PageHeader.tsx      # Consistent page title + optional action button
│       ├── FormField.tsx       # Label + input wrapper with error display
│       ├── FormSelect.tsx      # Label + select wrapper with error display
│       ├── LoadingState.tsx    # Centered spinner for async loading states
│       ├── EmptyState.tsx      # Empty list placeholder with optional call-to-action
│       └── StatCard.tsx        # Dashboard metric card (label + value + optional icon)
├── pages/
│   ├── index.ts                # Barrel — export all pages from here
│   ├── DashboardPage.tsx       # / — summary stats, recent activity
│   ├── ErrorPage.tsx           # Catch-all error boundary page
│   ├── LanguagePage.tsx        # /admin/language — toggle UI language (en/es)
│   ├── auth/
│   │   ├── LoginPage.tsx       # /login
│   │   └── SignupPage.tsx      # /signup
│   ├── families/
│   │   ├── FamiliesPage.tsx    # /families — paginated list + search
│   │   ├── FamilyDetailPage.tsx  # /families/:id — family overview, members, visits
│   │   └── AddFamilyPage.tsx   # /families/new — create family form
│   ├── children/
│   │   ├── AddChildPage.tsx    # /families/:id/children/new
│   │   └── ChildDetailPage.tsx # /families/:id/children/:cid — growth charts, visit history
│   ├── parents/
│   │   ├── AddParentPage.tsx   # /families/:id/parents/new
│   │   └── ParentDetailPage.tsx  # /families/:id/parents/:pid
│   ├── visits/
│   │   ├── AddChildVisitPage.tsx     # /families/:id/children/:cid/visits/new
│   │   ├── ChildVisitDetailPage.tsx  # /families/:id/children/:cid/visits/:vid
│   │   ├── AddFamilyVisitPage.tsx    # /families/:id/visits/new
│   │   └── FamilyVisitDetailPage.tsx # /families/:id/visits/:vid
│   ├── admin/
│   │   ├── AdminPage.tsx               # /admin — admin hub (SUPERVISOR+)
│   │   ├── AdminUsersPage.tsx          # /admin/users (ADMIN)
│   │   ├── AdminLookupsPage.tsx        # /admin/:table — Community, Resource, Training (ADMIN)
│   │   ├── AdminBirthingAssistantsPage.tsx  # /admin/birthing-assistants (SUPERVISOR+)
│   │   ├── AdminQuestionSetsPage.tsx   # /admin/question-sets/:visitType (ADMIN)
│   │   └── AdminSitesPage.tsx          # /admin/sites (ADMIN)
│   └── __tests__/              # Vitest + React Testing Library tests (one per page)
├── store/
│   └── auth.ts                 # Zustand store: user, accessToken, refreshToken, role, lang; persisted to localStorage
└── hooks/                      # Custom React hooks (shared logic extracted from pages)
```

**Key conventions:**
- Pages are functional components with both named and default exports
- Data fetching via TanStack Query (`useQuery`, `useMutation`) — never fetch in `useEffect`
- Query keys follow `['resource', id]` pattern for cache invalidation
- Auth state comes from `useAuthStore()` — never read tokens from localStorage directly
- Styling with Tailwind CSS only; use project palette (`hv-green`, `hv-accent`, `hv-crisis`, etc.)
- Add new components to `components/index.ts` barrel

---

## android/

Native Android application using Kotlin and Jetpack Compose. Separate Gradle build — not managed by pnpm/Turborepo.

Communicates with the backend via `POST /api/sync` for offline-first data entry.

---

## Environment Variables

### Backend (`packages/backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `PORT` | HTTP port (default: 3000) |

---

## RBAC Roles

| Role | Permissions |
|---|---|
| `CASEWORKER` | CRUD own assigned families, children, parents, visits |
| `SUPERVISOR` | All caseworker permissions + all families + soft-delete + birthing assistants |
| `ADMIN` | All supervisor permissions + users + lookup tables + sites + question sets + seed |

---

## Testing

```bash
# All packages
pnpm test

# Web only
pnpm --filter @naru/web test

# Backend only
pnpm --filter @naru/backend test

# Single file
cd packages/web && npx vitest run src/pages/__tests__/FamiliesPage.test.tsx
```

Backend tests use a real PostgreSQL test database (`naru_test`). Frontend tests use Vitest + React Testing Library with jsdom.

**Test patterns (frontend):**
- Mock API modules: `vi.mock('../../api/families')`
- Mock auth store: `vi.mock('../../store/auth')`
- Wrap with `QueryClientProvider` (retry: false) + `MemoryRouter`
