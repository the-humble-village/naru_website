import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { LookupCreateSchema, LookupUpdateSchema, LookupReorderSchema, type UserRead, type TokenPayload } from '@naru/shared';
import { auth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';
import * as adminService from '../services/admin.service';

// Type for Hono context with user variable
type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /admin/:table
 * List all entries for a lookup table
 * Any authenticated user can view lookups
 */
app.get('/:table', auth, zValidator('param', z.object({
  table: z.string(),
})), async (c) => {
  const { table } = c.req.valid('param');
  const entries = await adminService.listLookupEntries(table);
  return c.json(entries);
});

/**
 * POST /admin/:table
 * Create a new lookup entry
 * Admin role required
 */
app.post('/:table', auth, requireAdmin,
  zValidator('param', z.object({
    table: z.string(),
  })),
  zValidator('json', LookupCreateSchema),
  async (c) => {
    const { table } = c.req.valid('param');
    const data = c.req.valid('json');
    const entry = await adminService.createLookupEntry(table, data);
    return c.json(entry, 201);
  }
);

/**
 * PUT /admin/:table/reorder
 * Update sortOrder for a list of question entries
 * Admin role required — must be defined before /:table/:id to avoid "reorder" matching as :id
 */
app.put('/:table/reorder', auth, requireAdmin,
  zValidator('param', z.object({ table: z.string() })),
  zValidator('json', LookupReorderSchema),
  async (c) => {
    const { table } = c.req.valid('param');
    const items = c.req.valid('json');
    await adminService.reorderLookupEntries(table, items);
    return c.json({ message: 'Order updated' });
  }
);

/**
 * PUT /admin/:table/:id
 * Update a lookup entry by ID
 * Admin role required
 */
app.put('/:table/:id', auth, requireAdmin,
  zValidator('param', z.object({
    table: z.string(),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  zValidator('json', LookupUpdateSchema),
  async (c) => {
    const { table, id } = c.req.valid('param');
    const data = c.req.valid('json');
    const entry = await adminService.updateLookupEntry(table, id, data);
    return c.json(entry);
  }
);

/**
 * DELETE /admin/:table/:id
 * Soft delete a lookup entry
 * Admin role required
 */
app.delete('/:table/:id', auth, requireAdmin,
  zValidator('param', z.object({
    table: z.string(),
    id: z.string().transform(val => parseInt(val, 10)),
  })),
  async (c) => {
    const { table, id } = c.req.valid('param');
    await adminService.deleteLookupEntry(table, id);
    return c.json({ message: 'Entry deleted successfully' });
  }
);

export default app;