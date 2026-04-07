---
name: naru-backend
description: Naru backend patterns for adding new database tables, services, routes, and tests. Use when creating or modifying backend entities to ensure architectural consistency.
---

# Naru Backend Architecture Guide

This skill documents how to add new database tables and wire them through the full backend stack: Prisma model, shared Zod schema, service layer, route layer, test setup, and route mounting.

## Step-by-Step: Adding a New Entity

### 1. Prisma Model (`packages/backend/prisma/schema.prisma`)

Every model follows this template:

```prisma
model Widget {
  id        Int       @id @default(autoincrement())
  localId   String?   @unique @map("local_id")       // Only if syncable from mobile
  title     String    @db.VarChar(256)                // Domain fields
  notes     String?   @db.Text
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")              // Soft delete — always include

  // Relations — use Cascade for children, SetNull for optional references
  familyId  Int       @map("family_id")
  family    Family    @relation(fields: [familyId], references: [id], onDelete: Cascade)

  @@map("widgets")                                    // Snake_case plural table name
}
```

**Rules:**
- Every model gets `id`, `createdAt`, `updatedAt`, `deletedAt`
- Syncable models (created offline on mobile) also get `localId` (unique, optional)
- Use `@map("snake_case")` for all field names and `@@map("table_name")` for the table
- DB types: `@db.VarChar(n)` for bounded strings, `@db.Text` for unbounded, `@db.Json` for structured data
- Relations: `onDelete: Cascade` for child entities, `onDelete: SetNull` for optional FK references
- Many-to-many: use explicit junction tables with `@@id([fieldA, fieldB])`

After editing, run:
```bash
cd packages/backend && npx prisma migrate dev --name add_widgets
```

**Update test setup** — add the new table to the `beforeEach` cleanup in `packages/backend/tests/setup.ts`. Insert it in the correct foreign-key order (children before parents). Also add a `createTestWidget` helper if tests need seed data.

### 2. Shared Zod Schema (`packages/shared/src/schemas/widget.ts`)

Every entity gets three schema variants and their inferred types:

```typescript
import { z } from 'zod';

// What the client sends to create
export const WidgetCreateSchema = z.object({
  title: z.string().max(256),
  notes: z.string().optional().nullable(),
  familyId: z.number().int().positive(),
  localId: z.string().uuid().optional(),              // Only if syncable
});

// Partial version for updates
export const WidgetUpdateSchema = WidgetCreateSchema.partial();

// What the API returns — never includes deletedAt or passwordHash
export const WidgetReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  title: z.string(),
  notes: z.string().nullable(),
  familyId: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // deletedAt is NEVER exposed
});

export type WidgetCreate = z.infer<typeof WidgetCreateSchema>;
export type WidgetUpdate = z.infer<typeof WidgetUpdateSchema>;
export type WidgetRead = z.infer<typeof WidgetReadSchema>;
```

**Then export from the barrel** — add `export * from './widget.js';` to `packages/shared/src/schemas/index.ts`.

**Rebuild shared** after any change: `pnpm --filter @naru/shared build`

### 3. Service (`packages/backend/src/services/widget.service.ts`)

All database queries and business logic go here. Routes never touch Prisma directly.

```typescript
import { HTTPException } from 'hono/http-exception';
import {
  type WidgetCreate,
  type WidgetUpdate,
  type WidgetRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db';

// ── List with pagination ──────────────────────────────

export async function listWidgets(options: {
  search?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ widgets: WidgetRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  const where: any = {};
  if (options.search?.trim()) {
    where.title = { contains: options.search.trim(), mode: 'insensitive' };
  }

  const [widgets, total] = await Promise.all([
    prisma.widget.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        localId: true,
        title: true,
        notes: true,
        familyId: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude deletedAt
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.widget.count({ where }),
  ]);

  return {
    widgets: widgets.map(w => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    total,
  };
}

// ── Create ────────────────────────────────────────────

export async function createWidget(data: WidgetCreate): Promise<WidgetRead> {
  // Duplicate localId check (for offline sync)
  if (data.localId) {
    const existing = await prisma.widget.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });
    if (existing) {
      throw new HTTPException(400, { message: 'Widget with this localId already exists' });
    }
  }

  const widget = await prisma.widget.create({
    data: {
      title: data.title,
      notes: data.notes,
      familyId: data.familyId,
      localId: data.localId,
    },
    select: {
      id: true, localId: true, title: true, notes: true,
      familyId: true, createdAt: true, updatedAt: true,
    },
  });

  return {
    ...widget,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString(),
  };
}

// ── Get by ID ─────────────────────────────────────────

export async function getWidgetById(id: number, user: UserRead): Promise<WidgetRead> {
  const widget = await prisma.widget.findUnique({
    where: { id },
    select: {
      id: true, localId: true, title: true, notes: true,
      familyId: true, createdAt: true, updatedAt: true,
    },
  });

  if (!widget) {
    throw new HTTPException(404, { message: 'Widget not found' });
  }

  return {
    ...widget,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString(),
  };
}

// ── Update ────────────────────────────────────────────

export async function updateWidget(id: number, data: WidgetUpdate, user: UserRead): Promise<WidgetRead> {
  const existing = await prisma.widget.findUnique({
    where: { id },
    select: { id: true, localId: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Widget not found' });
  }

  if (data.localId && data.localId !== existing.localId) {
    const conflict = await prisma.widget.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });
    if (conflict) {
      throw new HTTPException(400, { message: 'Widget with this localId already exists' });
    }
  }

  const updated = await prisma.widget.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
    select: {
      id: true, localId: true, title: true, notes: true,
      familyId: true, createdAt: true, updatedAt: true,
    },
  });

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── Delete (soft) ─────────────────────────────────────

export async function deleteWidget(id: number, user: UserRead): Promise<void> {
  const existing = await prisma.widget.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Widget not found' });
  }

  await prisma.widget.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

**Key patterns:**
- Always use explicit `select` — never return `deletedAt` or `passwordHash`
- Convert `Date` objects to ISO strings before returning
- Throw `HTTPException(404)` when not found, `HTTPException(400)` for domain errors
- Check `localId` uniqueness on create and update
- Pagination: `skip` defaults to 0, `limit` defaults to 20 and caps at 100
- For nested resources (e.g., child under family), verify the parent exists first

### 4. Route (`packages/backend/src/routes/widget.ts`)

Routes are thin HTTP adapters — no business logic, just validation + delegation to service.

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  WidgetCreateSchema,
  WidgetUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireSupervisor } from '../middleware/role';
import * as widgetService from '../services/widget.service';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

// GET / — list with pagination
app.get('/', auth, async (c) => {
  const search = c.req.query('search');
  const skip = c.req.query('skip') ? parseInt(c.req.query('skip')!, 10) : undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
  const user = c.get('user') as UserRead;

  const result = await widgetService.listWidgets({ search, skip, limit, user });
  return c.json(result);
});

// POST / — create
app.post('/', auth, zValidator('json', WidgetCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const widget = await widgetService.createWidget(data);
  return c.json(widget, 201);
});

// GET /:id — fetch one
app.get('/:id', auth, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;
  return c.json(await widgetService.getWidgetById(id, user));
});

// PUT /:id — update
app.put('/:id', auth,
  zValidator('param', z.object({ id: z.string().transform(val => parseInt(val, 10)) })),
  zValidator('json', WidgetUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;
    return c.json(await widgetService.updateWidget(id, data, user));
  }
);

// DELETE /:id — soft delete (supervisor+)
app.delete('/:id', auth, requireSupervisor, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;
  await widgetService.deleteWidget(id, user);
  return c.json({ message: 'Widget deleted successfully' });
});

export default app;
```

**Middleware chain order:** `auth` -> role guard (if needed) -> `zValidator` -> handler

**Param validation:** URL params like `:id` are strings — use `z.string().transform(val => parseInt(val, 10))` to parse.

**Role guards available:**
- `requireAdmin` — ADMIN only
- `requireSupervisor` — SUPERVISOR or ADMIN
- `requireCaseworker` — any authenticated user (rarely needed since `auth` already gates)

### 5. Mount in App (`packages/backend/src/app.ts`)

Add the import and route mounting:

```typescript
import widgetRoutes from './routes/widget';

// Top-level resource
app.route('/api/widgets', widgetRoutes);

// OR nested under a parent resource
app.route('/api/families/:familyId/widgets', widgetRoutes);
```

Nested routes receive the parent ID via params — the route handler reads it from `c.req.param('familyId')` or validates with `zValidator('param', ...)`.

### 6. Backend Test (`packages/backend/tests/widget.test.ts`)

```typescript
// Set up environment BEFORE imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://calebr@127.0.0.1:5432/naru_test';

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import widgetRoutes from '../src/routes/widget';
import { testDb, createTestUser, createTestFamily } from './setup';
import { appConfig } from '../src/config';

const app = new Hono();
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});
app.route('/widgets', widgetRoutes);

const createTokens = (userId: number, role: string, lang = 'en') =>
  jwt.sign({ userId, role, lang }, appConfig.JWT_SECRET, { expiresIn: '15m' });

const testClient = {
  get: async (path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return app.request(new Request(`http://localhost${path}`, { method: 'GET', headers }));
  },
  post: async (path: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    return app.request(new Request(`http://localhost${path}`, {
      method: 'POST', headers, body: body ? JSON.stringify(body) : undefined,
    }));
  },
  put: async (path: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    return app.request(new Request(`http://localhost${path}`, {
      method: 'PUT', headers, body: body ? JSON.stringify(body) : undefined,
    }));
  },
  delete: async (path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return app.request(new Request(`http://localhost${path}`, { method: 'DELETE', headers }));
  },
};

describe('Widget Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const cw = await createTestUser({ login: 'caseworker', role: 'CASEWORKER' });
    const sv = await createTestUser({ login: 'supervisor', role: 'SUPERVISOR' });
    const ad = await createTestUser({ login: 'admin', role: 'ADMIN' });
    caseworkerToken = createTokens(cw.id, cw.role);
    supervisorToken = createTokens(sv.id, sv.role);
    adminToken = createTokens(ad.id, ad.role);
  });

  // Test auth (401), role gates (403), CRUD (200/201), not-found (404),
  // validation (400), and that deletedAt is never in responses.
});
```

**What to test:**
- 401 for unauthenticated requests on every endpoint
- 403 for insufficient role (e.g., caseworker trying to delete)
- 200/201 for successful CRUD operations
- 404 for non-existent IDs
- 400 for validation failures and duplicate localId
- Response structure: `deletedAt` is never present
- Soft delete: verify `deletedAt` is set in DB, record hidden from list endpoint

Run with: `cd packages/backend && npx vitest run tests/widget.test.ts`

## Architecture Invariants

1. **Soft delete everything** — set `deletedAt: new Date()`, never hard-delete. The soft-delete middleware in `src/middleware/soft-delete.ts` automatically filters `findMany`/`findFirst`/`findUnique` by `deletedAt: null` and converts `delete` to `update`.
2. **Never expose `deletedAt` or `passwordHash`** in API responses — use explicit `select` in every Prisma query.
3. **All business logic in services** — routes are thin HTTP adapters only.
4. **Validate all input with Zod** — schemas come from `@naru/shared`, applied via `zValidator`.
5. **No `any` types** — use `z.infer<typeof Schema>` for type inference.
6. **Date fields → ISO strings** — all `DateTime` values are converted via `.toISOString()` before returning.
7. **localId uniqueness** — check before create and update if the entity supports offline sync.
8. **Existence checks** — verify the record exists before update/delete; verify parent exists before creating a child entity.
9. **Pagination** — list endpoints return `{ items: T[], total: number }` with `skip`/`limit` query params. Default limit 20, max 100.
10. **Prisma migrations only** — never raw SQL or manual ALTER TABLE. Run `npx prisma migrate dev` after schema changes.

## File Checklist

When adding a new entity, touch these files:

| # | File | Action |
|---|------|--------|
| 1 | `packages/backend/prisma/schema.prisma` | Add Prisma model |
| 2 | `packages/shared/src/schemas/[entity].ts` | Create/Update/Read schemas + types |
| 3 | `packages/shared/src/schemas/index.ts` | Add `export * from './[entity].js'` |
| 4 | `packages/backend/src/services/[entity].service.ts` | CRUD functions |
| 5 | `packages/backend/src/routes/[entity].ts` | Hono route handlers |
| 6 | `packages/backend/src/app.ts` | Import + `app.route(...)` |
| 7 | `packages/backend/tests/setup.ts` | Add to cleanup + create helper |
| 8 | `packages/backend/tests/[entity].test.ts` | Route/service tests |

Then run:
```bash
cd packages/backend && npx prisma migrate dev --name add_[entity]
pnpm --filter @naru/shared build
cd packages/backend && npx vitest run tests/[entity].test.ts
```
