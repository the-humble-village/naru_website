# Getting Started

## Prerequisites

Install these before cloning the repo:

| Tool | Version | Install (macOS) |
|------|---------|-----------------|
| Node.js | v20+ | `brew install node` |
| pnpm | v9+ | `npm install -g pnpm` |
| PostgreSQL | 14+ | `brew install postgresql@16 && brew services start postgresql@16` |

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd NaruProject
pnpm install
```

This installs all dependencies across the monorepo (shared, backend, and web packages).

### 2. Create PostgreSQL databases

```bash
createdb naru
createdb naru_test
```

`naru` is for local development, `naru_test` is used by the backend test suite.

### 3. Configure environment variables

```bash
cd packages/backend
cp .env.example .env
```

Edit `packages/backend/.env`:

```env
DATABASE_URL=postgresql://<your-pg-username>@127.0.0.1:5432/naru
JWT_SECRET=pick-any-secret-string
JWT_REFRESH_SECRET=pick-a-different-secret-string
PORT=3000
```

Replace `<your-pg-username>` with your local PostgreSQL username (usually your macOS username — run `whoami` if unsure).

### 4. Run database migrations

```bash
cd packages/backend
npx prisma migrate dev
```

This creates all tables and generates the Prisma client. The database starts empty.

### 5. Build and verify

```bash
# From the project root
pnpm build
pnpm test
```

## Running the app

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend (http://localhost:3000)
cd packages/backend
pnpm dev

# Terminal 2 — Web frontend (http://localhost:5173)
cd packages/web
pnpm dev
```

The web dev server proxies `/api` requests to the backend.

### Create your first user

With both servers running, register via the web UI at `http://localhost:5173/signup`, or send a request directly:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login": "admin", "password": "yourpassword", "role": "ADMIN"}'
```

## Useful commands

```bash
pnpm build                         # Build all packages
pnpm test                          # Run all tests
pnpm --filter @naru/web test       # Web tests only
pnpm --filter @naru/backend test   # Backend tests only

# Prisma
cd packages/backend
npx prisma migrate dev             # Create/apply migrations
npx prisma generate                # Regenerate client after schema changes
npx prisma studio                  # Visual database browser
```
