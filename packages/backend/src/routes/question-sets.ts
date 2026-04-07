import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { QuestionSetCreateSchema, QuestionSetUpdateSchema, type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';
import * as questionSetService from '../services/question-set.service';

type Variables = { user: UserRead; tokenPayload: TokenPayload };

const app = new Hono<{ Variables: Variables }>();

const visitTypeSchema = z.object({
  visitType: z.enum(['child', 'parent', 'family']),
});

const visitTypeIdSchema = visitTypeSchema.extend({
  id: z.string().transform((v) => parseInt(v, 10)),
});

/** GET /question-sets/:visitType — list all sets */
app.get('/:visitType', auth, zValidator('param', visitTypeSchema), async (c) => {
  const { visitType } = c.req.valid('param');
  const sets = await questionSetService.listQuestionSets(visitType);
  return c.json(sets);
});

/** GET /question-sets/:visitType/:id — get one set */
app.get('/:visitType/:id', auth, zValidator('param', visitTypeIdSchema), async (c) => {
  const { visitType, id } = c.req.valid('param');
  const set = await questionSetService.getQuestionSet(visitType, id);
  return c.json(set);
});

/** POST /question-sets/:visitType — create a set */
app.post(
  '/:visitType',
  auth,
  requireAdmin,
  zValidator('param', visitTypeSchema),
  zValidator('json', QuestionSetCreateSchema),
  async (c) => {
    const { visitType } = c.req.valid('param');
    const data = c.req.valid('json');
    const set = await questionSetService.createQuestionSet(visitType, data);
    return c.json(set, 201);
  }
);

/** PUT /question-sets/:visitType/:id — update a set */
app.put(
  '/:visitType/:id',
  auth,
  requireAdmin,
  zValidator('param', visitTypeIdSchema),
  zValidator('json', QuestionSetUpdateSchema),
  async (c) => {
    const { visitType, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const set = await questionSetService.updateQuestionSet(visitType, id, data);
    return c.json(set);
  }
);

/** DELETE /question-sets/:visitType/:id — soft delete */
app.delete('/:visitType/:id', auth, requireAdmin, zValidator('param', visitTypeIdSchema), async (c) => {
  const { visitType, id } = c.req.valid('param');
  await questionSetService.deleteQuestionSet(visitType, id);
  return c.json({ message: 'Deleted' });
});

export default app;
