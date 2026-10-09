import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ProgramCreateSchema,
  ProgramUpdateSchema,
  ProgramKindEnum,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import * as programService from '../services/program.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  kind: ProgramKindEnum.optional(),
  activeOnly: z.string().optional(),
});

const IdParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

/**
 * GET /programs
 * Readable by any authenticated role — the sidebar renders from this.
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');

  const result = await programService.listPrograms({
    kind: query.kind,
    activeOnly: query.activeOnly === 'true',
  });

  return c.json({ items: result.programs, total: result.total });
});

/**
 * GET /programs/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');

  const program = await programService.getProgramById(id);
  return c.json(program);
});

/**
 * POST /programs
 * Admin only.
 */
app.post('/', auth, requireAdmin, zValidator('json', ProgramCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const program = await programService.createProgram(data);
  return c.json(program, 201);
});

/**
 * PUT /programs/:id
 * Admin only. kind and subjectType are locked after creation.
 */
app.put(
  '/:id',
  auth,
  requireAdmin,
  zValidator('param', IdParamSchema),
  zValidator('json', ProgramUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    const program = await programService.updateProgram(id, data);
    return c.json(program);
  }
);

/**
 * DELETE /programs/:id
 * Admin only. Refused while active enrollments exist.
 */
app.delete('/:id', auth, requireAdmin, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');

  await programService.deleteProgram(id);
  return c.json({ message: 'Program deleted successfully' });
});

export default app;
