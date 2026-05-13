import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  FamilyVisitCreateSchema,
  FamilyVisitUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import * as familyVisitService from '../services/family-visit.service.js';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families/:familyId/visits
 * List visits for a family
 */
app.get('/', auth, zValidator('param', z.object({
  familyId: z.string().transform(val => parseInt(val, 10)),
})), zValidator('query', z.object({
  skip: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
})), async (c) => {
  const { familyId } = c.req.valid('param');
  const { skip, limit } = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const familyVisits = await familyVisitService.listFamilyVisits(familyId, user, { skip, limit });
  return c.json(familyVisits);
});

/**
 * POST /families/:familyId/visits
 * Create a new family visit
 */
app.post('/', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', FamilyVisitCreateSchema.omit({ familyId: true })), // familyId comes from the URL
  async (c) => {
    const { familyId } = c.req.valid('param');
    const visitData = c.req.valid('json');

    // Add familyId from URL parameter
    const data = {
      ...visitData,
      familyId,
    };

    const familyVisit = await familyVisitService.createFamilyVisit(data);
    return c.json(familyVisit, 201);
  }
);

/**
 * GET /families/:familyId/visits/:id
 * Get family visit detail
 */
app.get('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const familyVisit = await familyVisitService.getFamilyVisitById(familyId, id, user);
    return c.json(familyVisit);
  }
);

/**
 * PUT /families/:familyId/visits/:id
 * Update family visit
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    familyId: z.string().transform(val => parseInt(val, 10)),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', FamilyVisitUpdateSchema.omit({ familyId: true })), // familyId cannot be updated
  async (c) => {
    const { familyId, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const familyVisit = await familyVisitService.updateFamilyVisit(familyId, id, data, user);
    return c.json(familyVisit);
  }
);

export default app;