import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ParentVisitCreateSchema,
  ParentVisitUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as parentVisitService from '../services/parent-visit.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families/:familyId/parents/:pid/visits
 * List visits for a parent
 */
app.get('/', auth, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
  pid: z.string().transform(val => parseInt(val, 10)),
})), zValidator('query', z.object({
  skip: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
})), async (c) => {
  const { familyId, pid: parentId } = c.req.valid('param');
  const { skip, limit } = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const parentVisits = await parentVisitService.listParentVisits(familyId, parentId, user, { skip, limit });
  return c.json(parentVisits);
});

/**
 * POST /families/:familyId/parents/:pid/visits
 * Create a new parent visit
 */
app.post('/', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    pid: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ParentVisitCreateSchema.omit({ familyId: true, parentId: true })),
  async (c) => {
    const { familyId, pid: parentId } = c.req.valid('param');
    const visitData = c.req.valid('json');

    const data = {
      ...visitData,
      familyId,
      parentId,
    };

    const parentVisit = await parentVisitService.createParentVisit(data);
    return c.json(parentVisit, 201);
  }
);

/**
 * GET /families/:familyId/parents/:pid/visits/:id
 * Get parent visit detail
 */
app.get('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    pid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { familyId, pid: parentId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const parentVisit = await parentVisitService.getParentVisitById(familyId, parentId, id, user);
    return c.json(parentVisit);
  }
);

/**
 * PUT /families/:familyId/parents/:pid/visits/:id
 * Update parent visit
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    pid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ParentVisitUpdateSchema.omit({ familyId: true, parentId: true })),
  async (c) => {
    const { familyId, pid: parentId, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const parentVisit = await parentVisitService.updateParentVisit(familyId, parentId, id, data, user);
    return c.json(parentVisit);
  }
);

/**
 * DELETE /families/:familyId/parents/:pid/visits/:id
 * Soft delete parent visit (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    pid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { familyId, pid: parentId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    await parentVisitService.deleteParentVisit(familyId, parentId, id, user);
    return c.json({ message: 'Parent visit deleted successfully' });
  }
);

export default app;
