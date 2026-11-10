# HumbleVillage (NaruProject)

A family health tracking system for Humble Village's community health workers. People are **enrolled** in **programs** (pregnancy, nutrition, midwives, students, family support), and every visit is recorded against an enrollment.

## Quick start

Prerequisites: Node 24, pnpm, and PostgreSQL 16. First-time setup (databases, `.env`, migrations, seeding programs, creating your first admin) is in **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)**.

```bash
pnpm install
pnpm dev            # backend :3000, web :5173 (proxies /api to the backend)
pnpm test
pnpm build
```

## Repository layout

```
apps/                # Deployables
├── backend/         # @naru/backend — Hono REST API, Prisma, PostgreSQL
├── web/             # @naru/web — React SPA (Vite, TanStack Query, Tailwind)
└── android/         # Native Android app — placeholder, frozen
packages/            # Libraries the apps import
└── shared/          # @naru/shared — Zod schemas, WHO z-scores, i18n (en/es)
docs/                # Design docs, setup and deployment guides
deployment/, nginx/  # Server config shipped by CI
```

- **`@naru/shared`** is the contract between backend and web. Every entity has `*CreateSchema`, `*UpdateSchema` and `*ReadSchema`, and both apps validate against them. Rebuild after editing: `pnpm --filter @naru/shared build`.
- **`@naru/backend`** keeps HTTP handling in `src/routes/` and all queries and business logic in `src/services/`. `prisma/schema.prisma` is the single source of truth for the database.
- **`@naru/web`** has one page per route under `src/pages/`, wired up in `App.tsx`, and one API client per resource under `src/api/`.
- **Android** is frozen: `/api/sync` has been removed and its code isn't in this repo. See [apps/android](./apps/android/README.md).

## Documentation

| Doc | Read it when |
|---|---|
| [GETTING_STARTED](./docs/GETTING_STARTED.md) | Setting up a machine |
| [SCHEMA_V2](./docs/SCHEMA_V2.md) | **Before changing the schema.** The program-centric data model and why |
| [WEB_DESIGN_V2](./docs/WEB_DESIGN_V2.md) | Adding or changing a page: route map, pages, components |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | You want the system diagrams |
| [DEPLOYMENT](./docs/DEPLOYMENT.md) | Deploying or touching the server |
| [CLAUDE.md](./CLAUDE.md) | Conventions and invariants, written for AI assistants but just as useful for people |

## Environment variables

Backend, in `apps/backend/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing key. Minimum 32 characters; checked at boot |
| `JWT_REFRESH_SECRET` | Refresh token signing key. Minimum 32 characters, and must differ from `JWT_SECRET` |
| `PORT` | HTTP port (default: 3000) |

Generate each secret with `openssl rand -base64 48`.

## Roles

| Role | Can |
|---|---|
| `CASEWORKER` | Create and edit subjects (mothers, children, people, families), enrollments and visits |
| `SUPERVISOR` | Everything a caseworker can, plus soft-delete and manage birthing assistants |
| `ADMIN` | Everything a supervisor can, plus manage users, programs, sites, question sets and lookup tables |

Roles control what a user can **do**, not what they can **see**: every role sees every record.

## Testing

```bash
pnpm --filter @naru/web test        # Vitest + React Testing Library (jsdom)
pnpm --filter @naru/backend test    # Vitest against a real PostgreSQL database, naru_test
cd apps/web && npx vitest run src/pages/__tests__/FamiliesPage.test.tsx   # one file
```

The backend suite connects to `postgresql://$USER@127.0.0.1:5432/naru_test` unless `TEST_DATABASE_URL` is set. See [GETTING_STARTED](./docs/GETTING_STARTED.md#4-apply-database-migrations) to create and migrate it.
