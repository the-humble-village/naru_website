import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  FamilyCreateSchema,
  FamilyUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as familyService from '../services/family.service.js';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /families
 * List families with pagination and filtering
 * Caseworkers see assigned families only, supervisors+ see all
 */
app.get('/', auth, async (c) => {
  // Parse query parameters
  const search = c.req.query('search');
  const skipParam = c.req.query('skip');
  const limitParam = c.req.query('limit');
  const communityId = c.req.query('communityId');
  const inCrisis = c.req.query('inCrisis');

  const skip = skipParam ? parseInt(skipParam, 10) : undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const user = c.get('user') as UserRead;

  const result = await familyService.listFamilies({
    search,
    skip,
    limit,
    communityId,
    inCrisis,
    user
  });

  return c.json(result);
});

/**
 * POST /families
 * Create a new family
 */
app.post('/', auth, zValidator('json', FamilyCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const family = await familyService.createFamily(data);
  return c.json(family, 201);
});

/**
 * GET /families/:id
 * Get family by ID with related data
 */
app.get('/:id', auth, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;
  const family = await familyService.getFamilyById(id, user);
  return c.json(family);
});

/**
 * PUT /families/:id
 * Update family by ID
 */
app.put('/:id', auth,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', FamilyUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;
    const family = await familyService.updateFamily(id, data, user);
    return c.json(family);
  }
);

/**
 * DELETE /families/:id
 * Soft delete family (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;
  await familyService.deleteFamily(id, user);
  return c.json({ message: 'Family deleted successfully' });
});

export default app;