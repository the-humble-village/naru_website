import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  PhotoAttachmentCreateSchema,
  PhotoAttachmentUpdateSchema,
  PhotoAttachmentReorderSchema,
  PhotoOwnerTypeEnum,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as photoService from '../services/photo-attachment.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  ownerType: PhotoOwnerTypeEnum.optional(),
  ownerId: z.string().optional(),
  fileId: z.string().optional(),
  skip: z.string().optional(),
  limit: z.string().optional(),
});

const IdParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * GET /photos?ownerType=VISIT&ownerId=12
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await photoService.listPhotoAttachments({
    ownerType: query.ownerType,
    ownerId: toInt(query.ownerId),
    fileId: toInt(query.fileId),
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.photos,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /photos
 */
app.post('/', auth, zValidator('json', PhotoAttachmentCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user') as UserRead;

  const photo = await photoService.createPhotoAttachment(data, user);
  return c.json(photo, 201);
});

/**
 * POST /photos/reorder
 * Registered before /:id so the literal wins.
 */
app.post('/reorder', auth, zValidator('json', PhotoAttachmentReorderSchema), async (c) => {
  const { ownerType, ownerId, photoIds } = c.req.valid('json');
  const user = c.get('user') as UserRead;

  const result = await photoService.reorderPhotoAttachments(ownerType, ownerId, photoIds, user);
  return c.json({ items: result.photos, total: result.total });
});

/**
 * GET /photos/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const photo = await photoService.getPhotoAttachmentById(id, user);
  return c.json(photo);
});

/**
 * PUT /photos/:id
 * Caption and sortOrder only — fileId, ownerType and ownerId are locked after
 * creation, so an attachment can never be re-pointed at another patient.
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', PhotoAttachmentUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const photo = await photoService.updatePhotoAttachment(id, data, user);
    return c.json(photo);
  }
);

/**
 * DELETE /photos/:id
 * Soft delete (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await photoService.deletePhotoAttachment(id, user);
  return c.json({ message: 'Photo attachment deleted successfully' });
});

export default app;
