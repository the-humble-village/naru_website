import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  VisitCreateSchema,
  VisitUpdateSchema,
  DateOnlySchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as visitService from '../services/visit.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  enrollmentId: z.string().optional(),
  programId: z.string().optional(),
  siteId: z.string().optional(),
  communityId: z.string().optional(),
  eventId: z.string().optional(),
  recordedById: z.string().optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  skip: z.string().optional(),
  limit: z.string().optional(),
});

const PrefillQuerySchema = z.object({
  enrollmentId: z.string(),
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
 * GET /visits
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await visitService.listVisits({
    enrollmentId: toInt(query.enrollmentId),
    programId: toInt(query.programId),
    siteId: toInt(query.siteId),
    communityId: toInt(query.communityId),
    eventId: toInt(query.eventId),
    recordedById: toInt(query.recordedById),
    from: query.from,
    to: query.to,
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.visits,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * GET /visits/prefill?enrollmentId=N
 * Defaults for a new visit form. Registered before /:id so the literal wins.
 */
app.get('/prefill', auth, zValidator('query', PrefillQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const enrollmentId = toInt(query.enrollmentId);

  if (enrollmentId === undefined) {
    return c.json({ error: 'enrollmentId must be a number' }, 400);
  }

  const prefill = await visitService.getVisitPrefill(enrollmentId, user);
  return c.json(prefill);
});

/**
 * POST /visits
 */
app.post('/', auth, zValidator('json', VisitCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user') as UserRead;

  const visit = await visitService.createVisit(data, user);
  return c.json(visit, 201);
});

/**
 * GET /visits/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const visit = await visitService.getVisitById(id, user);
  return c.json(visit);
});

/**
 * PUT /visits/:id
 * The enrollment is immutable — a visit cannot be moved to another enrollment.
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', VisitUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const visit = await visitService.updateVisit(id, data, user);
    return c.json(visit);
  }
);

/**
 * DELETE /visits/:id
 * Soft delete (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await visitService.deleteVisit(id, user);
  return c.json({ message: 'Visit deleted successfully' });
});

export default app;
