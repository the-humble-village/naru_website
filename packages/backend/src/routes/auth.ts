import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { LoginSchema } from '@naru/shared';
import { z } from 'zod';
import { loginRateLimit } from '../middleware/rate-limit.js';
import * as authService from '../services/auth.service.js';

// There is deliberately no registration endpoint. Accounts are created by an
// admin through POST /api/users, which is the only path that can set a role.
const app = new Hono();

/**
 * POST /login
 * Authenticate user with login/password
 *
 * The limiter is mounted here rather than in app.ts so it is in the path of
 * tests/auth.test.ts, which builds its own Hono instance around these routes.
 */
app.post('/login', loginRateLimit, zValidator('json', LoginSchema), async (c) => {
  const data = c.req.valid('json');
  const authResponse = await authService.login(data);
  return c.json(authResponse);
});

/**
 * POST /refresh
 * Exchange refresh token for new access token
 */
app.post('/refresh', zValidator('json', z.object({
  refreshToken: z.string().min(1),
})), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const authResponse = await authService.refreshToken(refreshToken);
  return c.json(authResponse);
});

export default app;