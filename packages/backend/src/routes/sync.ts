import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SyncRequestSchema, type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth';
import * as syncService from '../services/sync.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * POST /sync
 * Process sync request from client
 */
app.post(
  '/',
  auth,
  zValidator('json', SyncRequestSchema),
  async (c) => {
    const syncRequest = c.req.valid('json');
    const user = c.get('user');

    const syncResponse = await syncService.processSyncRequest(syncRequest, user);

    return c.json(syncResponse);
  }
);

export default app;