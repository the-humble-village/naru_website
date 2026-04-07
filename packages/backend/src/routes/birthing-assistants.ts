import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  BirthingAssistantCreateSchema,
  BirthingAssistantUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireSupervisor } from '../middleware/role';
import * as birthingAssistantService from '../services/birthing-assistant.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /birthing-assistants
 * List all birthing assistants with communities and trainings
 */
app.get('/', auth, async (c) => {
  const birthingAssistants = await birthingAssistantService.listBirthingAssistants();
  return c.json(birthingAssistants);
});

/**
 * POST /birthing-assistants
 * Create a new birthing assistant (supervisor+ only)
 */
app.post('/', auth, requireSupervisor, zValidator('json', BirthingAssistantCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const birthingAssistant = await birthingAssistantService.createBirthingAssistant(data);
  return c.json(birthingAssistant, 201);
});

/**
 * GET /birthing-assistants/:id
 * Get birthing assistant by ID
 */
app.get('/:id', auth, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const birthingAssistant = await birthingAssistantService.getBirthingAssistantById(id);
  return c.json(birthingAssistant);
});

/**
 * PUT /birthing-assistants/:id
 * Update birthing assistant by ID (supervisor+ only)
 */
app.put('/:id', auth, requireSupervisor,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', BirthingAssistantUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const birthingAssistant = await birthingAssistantService.updateBirthingAssistant(id, data);
    return c.json(birthingAssistant);
  }
);

/**
 * DELETE /birthing-assistants/:id
 * Soft delete birthing assistant (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  await birthingAssistantService.deleteBirthingAssistant(id);
  return c.json({ message: 'Birthing assistant deleted successfully' });
});

export default app;