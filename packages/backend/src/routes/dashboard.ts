import { Hono } from 'hono';
import { type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth';
import * as dashboardService from '../services/dashboard.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /dashboard
 * Get dashboard data with recent visits, recently updated children, families in crisis, and summary stats
 */
app.get('/', auth, async (c) => {
  const user = c.get('user') as UserRead;
  const dashboardData = await dashboardService.getDashboardData(user);
  return c.json(dashboardData);
});

export default app;