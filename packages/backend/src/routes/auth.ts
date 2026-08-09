import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { LoginSchema } from '@naru/shared';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';

// There is deliberately no registration endpoint. Accounts are created by an
// admin through POST /api/users, which is the only path that can set a role.
const app = new Hono();

/**
 * POST /login
 * Authenticate user with login/password
 */
app.post('/login', zValidator('json', LoginSchema), async (c) => {
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