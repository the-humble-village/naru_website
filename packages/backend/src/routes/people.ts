import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  PersonCreateSchema,
  PersonUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as personService from '../services/person.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  communityId: z.string().optional(),
  siteId: z.string().optional(),
  programId: z.string().optional(),
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
 * GET /people
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await personService.listPeople({
    communityId: toInt(query.communityId),
    siteId: toInt(query.siteId),
    programId: toInt(query.programId),
    unenrolled: query.unenrolled === 'true',
    search: query.search,
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.people,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /people
 */
app.post('/', auth, zValidator('json', PersonCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const person = await personService.createPerson(data);
  return c.json(person, 201);
});

/**
 * GET /people/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const person = await personService.getPersonById(id, user);
  return c.json(person);
});

/**
 * GET /people/:id/mothers
 * The midwife caseload — mothers this person accompanies.
 */
app.get('/:id/mothers', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');

  const mothers = await personService.listAssignedMothers(id);
  return c.json({ items: mothers, total: mothers.length });
});

/**
 * PUT /people/:id
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', PersonUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const person = await personService.updatePerson(id, data, user);
    return c.json(person);
  }
);

/**
 * DELETE /people/:id
 * Soft delete (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await personService.deletePerson(id, user);
  return c.json({ message: 'Person deleted successfully' });
});

export default app;
