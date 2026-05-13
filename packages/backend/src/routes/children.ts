import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ChildCreateSchema,
  ChildUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as childService from '../services/child.service.js';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families/:familyId/children
 * List children in a family
 */
app.get('/', auth, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { familyId } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const children = await childService.listChildren(familyId, user);
  return c.json(children);
});

/**
 * POST /families/:familyId/children
 * Add child to family
 */
app.post('/', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ChildCreateSchema.omit({ familyId: true })), // familyId comes from the URL
  async (c) => {
    const { familyId } = c.req.valid('param');
    const childData = c.req.valid('json');

    // Add familyId from URL parameter
    const data = {
      ...childData,
      familyId,
    };

    const child = await childService.createChild(data);
    return c.json(child, 201);
  }
);

/**
 * GET /families/:familyId/children/:id
 * Get child detail with z-scores
 */
app.get('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const child = await childService.getChildById(familyId, id, user);
    return c.json(child);
  }
);

/**
 * PUT /families/:familyId/children/:id
 * Update child
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ChildUpdateSchema.omit({ familyId: true })), // familyId cannot be updated
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const child = await childService.updateChild(familyId, id, data, user);
    return c.json(child);
  }
);

/**
 * DELETE /families/:familyId/children/:id
 * Soft delete child (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    await childService.deleteChild(familyId, id, user);
    return c.json({ message: 'Child deleted successfully' });
  }
);

export default app;