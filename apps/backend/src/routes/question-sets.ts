import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  QuestionSetCreateSchema,
  QuestionSetUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import * as questionSetService from '../services/question-set.service.js';

type Variables = { user: UserRead; tokenPayload: TokenPayload };
const app = new Hono<{ Variables: Variables }>();

const IdParamSchema = z.object({ id: z.string().transform(Number) });

const ListQuerySchema = z.object({
  programId: z.string().optional(),
  includeShared: z.enum(['true', 'false']).optional(),
});

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * GET /question-sets?programId=3&includeShared=true
 * The visit form passes includeShared; the admin screen does not.
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');

  return c.json(
    await questionSetService.listQuestionSets({
      programId: toInt(query.programId),
      includeShared: query.includeShared === 'true',
    })
  );
});

app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  return c.json(await questionSetService.getQuestionSet(c.req.valid('param').id));
});

app.post('/', auth, requireAdmin, zValidator('json', QuestionSetCreateSchema), async (c) => {
  return c.json(await questionSetService.createQuestionSet(c.req.valid('json')), 201);
});

app.put(
  '/:id',
  auth,
  requireAdmin,
  zValidator('param', IdParamSchema),
  zValidator('json', QuestionSetUpdateSchema),
  async (c) => {
    return c.json(
      await questionSetService.updateQuestionSet(c.req.valid('param').id, c.req.valid('json'))
    );
  }
);

app.delete('/:id', auth, requireAdmin, zValidator('param', IdParamSchema), async (c) => {
  await questionSetService.deleteQuestionSet(c.req.valid('param').id);
  return c.json({ message: 'Question set deleted successfully' });
});

export default app;
