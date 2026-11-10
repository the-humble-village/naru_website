import { Hono } from 'hono';
import { type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth.js';
import * as dashboardService from '../services/dashboard.service.js';

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

/**
 * GET /dashboard/unenrolled-count
 * Subjects holding no active enrollment, broken down by subject table.
 * Feeds the sidebar badge, so it stays cheap.
 */
app.get('/unenrolled-count', auth, async (c) => {
  const counts = await dashboardService.getUnenrolledCount();
  return c.json(counts);
});

export default app;