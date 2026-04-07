import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  SearchQuerySchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth';
import * as searchService from '../services/search.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /search?q=
 * Search across families, parents, children by name
 */
app.get('/', auth, zValidator('query', SearchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const results = await searchService.searchByName(q, user);
  return c.json(results);
});

export default app;