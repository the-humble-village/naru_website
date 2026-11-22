import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ChildCreateSchema,
  ChildUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as childService from '../services/child.service.js';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  familyId: z.string().optional(),
  motherId: z.string().optional(),
  communityId: z.string().optional(),
  siteId: z.string().optional(),
  unenrolled: z.string().optional(),
  search: z.string().optional(),
  skip: z.string().optional(),
  limit: z.string().optional(),
});

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * GET /children
 * List children, optionally filtered by family, mother, community, or enrollment state
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await childService.listChildren({
    familyId: toInt(query.familyId),
    motherId: toInt(query.motherId),
    communityId: toInt(query.communityId),
    siteId: toInt(query.siteId),
    unenrolled: query.unenrolled === 'true',
    search: query.search,
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.children,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /children
 * Create a child. familyId and motherId are both optional — a malnourished
 * infant must be admittable with neither.
 */
app.post('/', auth, zValidator('json', ChildCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const child = await childService.createChild(data);
  return c.json(child, 201);
});

/**
 * GET /children/:id
 */
app.get('/:id', auth,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const child = await childService.getChildById(id, user);
    return c.json(child);
  }
);

/**
 * PUT /children/:id
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ChildUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const child = await childService.updateChild(id, data, user);
    return c.json(child);
  }
);

/**
 * DELETE /children/:id
 * Soft delete child (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    await childService.deleteChild(id, user);
    return c.json({ message: 'Child deleted successfully' });
  }
);

export default app;
