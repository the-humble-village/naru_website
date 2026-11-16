import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  EventCreateSchema,
  EventUpdateSchema,
  DateOnlySchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as eventService from '../services/event.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  search: z.string().optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
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
 * GET /events
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await eventService.listEvents({
    search: query.search,
    from: query.from,
    to: query.to,
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.events,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /events
 */
app.post('/', auth, zValidator('json', EventCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user') as UserRead;

  const event = await eventService.createEvent(data, user);
  return c.json(event, 201);
});

/**
 * GET /events/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const event = await eventService.getEventById(id, user);
  return c.json(event);
});

/**
 * PUT /events/:id
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', EventUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const event = await eventService.updateEvent(id, data, user);
    return c.json(event);
  }
);

/**
 * DELETE /events/:id
 * Soft delete (supervisor+ only). Attached visits keep their eventId.
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await eventService.deleteEvent(id, user);
  return c.json({ message: 'Event deleted successfully' });
});

export default app;
