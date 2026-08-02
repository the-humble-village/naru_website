import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ChildVisitCreateSchema,
  ChildVisitUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as childVisitService from '../services/child-visit.service.js';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families/:fid/children/:cid/visits
 * List visits for a child
 */
app.get('/', auth, zValidator('param', z.object({
  fid: z.string().transform(val => parseInt(val, 10)),
  cid: z.string().transform(val => parseInt(val, 10)),
})), zValidator('query', z.object({
  skip: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
})), async (c) => {
  const { fid: familyId, cid: childId } = c.req.valid('param');
  const { skip, limit } = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await childVisitService.listChildVisits(familyId, childId, user, { skip, limit });
  return c.json(result);
});

/**
 * POST /families/:fid/children/:cid/visits
 * Create a new child visit
 */
app.post('/', auth,
  zValidator('param', z.object({
    fid: z.string().transform(val => parseInt(val, 10)),
    cid: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ChildVisitCreateSchema.omit({ familyId: true, childId: true })), // familyId and childId come from the URL
  async (c) => {
    const { fid: familyId, cid: childId } = c.req.valid('param');
    const visitData = c.req.valid('json');

    // Add familyId and childId from URL parameters
    const data = {
      ...visitData,
      familyId,
      childId,
    };

    const childVisit = await childVisitService.createChildVisit(data);
    return c.json(childVisit, 201);
  }
);

/**
 * GET /families/:fid/children/:cid/visits/:id
 * Get child visit detail
 */
app.get('/:id', auth,
  zValidator('param', z.object({
    fid: z.string().transform(val => parseInt(val, 10)),
    cid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { fid: familyId, cid: childId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const childVisit = await childVisitService.getChildVisitById(familyId, childId, id, user);
    return c.json(childVisit);
  }
);

/**
 * PUT /families/:fid/children/:cid/visits/:id
 * Update child visit
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    fid: z.string().transform(val => parseInt(val, 10)),
    cid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', ChildVisitUpdateSchema.omit({ familyId: true, childId: true })), // familyId and childId cannot be updated
  async (c) => {
    const { fid: familyId, cid: childId, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const childVisit = await childVisitService.updateChildVisit(familyId, childId, id, data, user);
    return c.json(childVisit);
  }
);

/**
 * DELETE /families/:fid/children/:cid/visits/:id
 * Soft delete child visit (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor,
  zValidator('param', z.object({
    fid: z.string().transform(val => parseInt(val, 10)),
    cid: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { fid: familyId, cid: childId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    await childVisitService.deleteChildVisit(familyId, childId, id, user);
    return c.json({ message: 'Child visit deleted successfully' });
  }
);

export default app;