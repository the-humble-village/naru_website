import { Hono } from 'hono';
import { type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/role.js';
import * as seedService from '../services/seed.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * POST /seed/generate
 * Generate test data (communities, sites, families, children, etc.)
 * Admin role required
 */
app.post('/generate', auth, requireAdmin, async (c) => {
  const result = await seedService.generateTestData();
  return c.json({
    message: 'Test data generated successfully',
    created: result,
  }, 201);
});

export default app;
