import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  MotherCreateSchema,
  MotherUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as motherService from '../services/mother.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  familyId: z.string().optional(),
  midwifeId: z.string().optional(),
  communityId: z.string().optional(),
  siteId: z.string().optional(),
  unenrolled: z.string().optional(),
  search: z.string().optional(),
  skip: z.string().optional(),
  limit: z.string().optional(),
});

const IdParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * GET /mothers
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await motherService.listMothers({
    familyId: toInt(query.familyId),
    midwifeId: toInt(query.midwifeId),
    communityId: toInt(query.communityId),
    siteId: toInt(query.siteId),
    unenrolled: query.unenrolled === 'true',
    search: query.search,
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.mothers,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /mothers
 */
app.post('/', auth, zValidator('json', MotherCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const mother = await motherService.createMother(data);
  return c.json(mother, 201);
});

/**
 * GET /mothers/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const mother = await motherService.getMotherById(id, user);
  return c.json(mother);
});

/**
 * PUT /mothers/:id
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', MotherUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const mother = await motherService.updateMother(id, data, user);
    return c.json(mother);
  }
);

/**
 * DELETE /mothers/:id
 * Soft delete (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await motherService.deleteMother(id, user);
  return c.json({ message: 'Mother deleted successfully' });
});

export default app;
