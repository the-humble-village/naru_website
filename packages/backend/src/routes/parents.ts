import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ParentCreateSchema,
  ParentUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireSupervisor } from '../middleware/role';
import * as parentService from '../services/parent.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families/:familyId/parents
 * List all parents in a family
 */
app.get('/', auth, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { familyId } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const parents = await parentService.listParents(familyId, user);
  return c.json(parents);
});

/**
 * POST /families/:familyId/parents
 * Create a new parent in a family
 */
app.post('/', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ParentCreateSchema.omit({ familyId: true })), // familyId comes from URL
  async (c) => {
    const { familyId } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const parent = await parentService.createParent(familyId, { ...data, familyId }, user);
    return c.json(parent, 201);
  }
);

/**
 * GET /families/:familyId/parents/:id
 * Get a specific parent in a family
 */
app.get('/:id', auth, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { familyId, id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const parent = await parentService.getParentById(familyId, id, user);
  return c.json(parent);
});

/**
 * PUT /families/:familyId/parents/:id
 * Update a specific parent in a family
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ParentUpdateSchema.omit({ familyId: true })), // familyId comes from URL
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const parent = await parentService.updateParent(familyId, id, data, user);
    return c.json(parent);
  }
);

/**
 * DELETE /families/:familyId/parents/:id
 * Soft delete a specific parent in a family (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { familyId, id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await parentService.deleteParent(familyId, id, user);
  return c.json({ message: 'Parent deleted successfully' });
});

export default app;