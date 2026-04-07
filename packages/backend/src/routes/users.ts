import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  UserCreateSchema,
  UserUpdateSchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';
import * as userService from '../services/user.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /users
 * List all users (admin only)
 */
app.get('/', auth, requireAdmin, async (c) => {
  // Get query parameters manually for now
  const skipParam = c.req.query('skip');
  const limitParam = c.req.query('limit');
  const skip = skipParam ? parseInt(skipParam, 10) : undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const result = await userService.listUsers({ skip, limit });
  return c.json(result);
});

/**
 * GET /users/me
 * Get current user profile
 */
app.get('/me', auth, async (c) => {
  const user = c.get('user') as UserRead;
  return c.json(user);
});

/**
 * GET /users/:id
 * Get user by ID (admin only)
 */
app.get('/:id', auth, requireAdmin, zValidator('param', z.object({
  id: z.string().transform(val => parseInt(val, 10)),
})), async (c) => {
  const { id } = c.req.valid('param');
  const user = await userService.getUserById(id);
  return c.json(user);
});

/**
 * PUT /users/:id
 * Update user by ID (admin only)
 */
app.put('/:id', auth, requireAdmin,
  zValidator('param', z.object({
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', UserUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = await userService.updateUser(id, data);
    return c.json(user);
  }
);

/**
 * PATCH /users/me/language
 * Update current user's language preference
 */
app.patch('/me/language', auth, zValidator('json', z.object({
  lang: z.string().max(5).min(1),
})), async (c) => {
  const user = c.get('user') as UserRead;
  const { lang } = c.req.valid('json');
  const updatedUser = await userService.updateUserLanguage(user.id, lang);
  return c.json(updatedUser);
});

/**
 * POST /users (admin only)
 * Create a new user
 */
app.post('/', auth, requireAdmin, zValidator('json', UserCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const user = await userService.createUser(data);
  return c.json(user, 201);
});

export default app;