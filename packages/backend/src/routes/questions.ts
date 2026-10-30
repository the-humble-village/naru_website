import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  QuestionCreateSchema,
  QuestionUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import * as questionService from '../services/question.service.js';

type Variables = { user: UserRead; tokenPayload: TokenPayload };
const app = new Hono<{ Variables: Variables }>();

const IdParamSchema = z.object({ id: z.string().transform(Number) });

// Readable by any role — the visit form renders these. Writes are admin only.
app.get('/', auth, async (c) => {
  return c.json(await questionService.listQuestions());
});

app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  return c.json(await questionService.getQuestion(c.req.valid('param').id));
});

app.post('/', auth, requireAdmin, zValidator('json', QuestionCreateSchema), async (c) => {
  return c.json(await questionService.createQuestion(c.req.valid('json')), 201);
});

app.put(
  '/:id',
  auth,
  requireAdmin,
  zValidator('param', IdParamSchema),
  zValidator('json', QuestionUpdateSchema),
  async (c) => {
    return c.json(
      await questionService.updateQuestion(c.req.valid('param').id, c.req.valid('json'))
    );
  }
);

app.delete('/:id', auth, requireAdmin, zValidator('param', IdParamSchema), async (c) => {
  await questionService.deleteQuestion(c.req.valid('param').id);
  return c.json({ message: 'Question deleted successfully' });
});

export default app;
