import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SiteCreateSchema, SiteUpdateSchema, type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';
import * as siteService from '../services/site.service';

type Variables = { user: UserRead; tokenPayload: TokenPayload };
const app = new Hono<{ Variables: Variables }>();

app.get('/', auth, async (c) => {
  return c.json(await siteService.listSites());
});

app.get('/:id', auth, zValidator('param', z.object({ id: z.string().transform(Number) })), async (c) => {
  return c.json(await siteService.getSite(c.req.valid('param').id));
});

app.post('/', auth, requireAdmin, zValidator('json', SiteCreateSchema), async (c) => {
  return c.json(await siteService.createSite(c.req.valid('json')), 201);
});

app.put('/:id', auth, requireAdmin,
  zValidator('param', z.object({ id: z.string().transform(Number) })),
  zValidator('json', SiteUpdateSchema),
  async (c) => {
    return c.json(await siteService.updateSite(c.req.valid('param').id, c.req.valid('json')));
  }
);

app.delete('/:id', auth, requireAdmin, zValidator('param', z.object({ id: z.string().transform(Number) })), async (c) => {
  await siteService.deleteSite(c.req.valid('param').id);
  return c.json({ message: 'Deleted' });
});

export default app;
