import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { auth } from '../middleware/auth.js';
import * as fileService from '../services/file.service.js';
import { HTTPException } from 'hono/http-exception';
import { verifyToken, writeLocalFile, readLocalFile } from '../storage/local.js';
import {
  PresignUploadRequestSchema,
  ConfirmUploadRequestSchema,
  PresignDownloadRequestSchema,
} from '@naru/shared';

const app = new Hono();

/**
 * PUT/GET /files/local?token=...
 *
 * Local-storage driver only. These are the endpoints the LocalStorage driver
 * hands back as "presigned" upload/download URLs. They are intentionally NOT
 * behind `auth` — the browser can't attach a JWT to a raw PUT or an <img> load
 * — so access is gated by the short-TTL HMAC token in the query string.
 */
app.put('/local', async (c) => {
  const payload = verifyToken(c.req.query('token') ?? '', 'put');
  if (!payload) {
    throw new HTTPException(403, { message: 'Invalid or expired upload token' });
  }
  const body = Buffer.from(await c.req.arrayBuffer());
  await writeLocalFile(payload.key, body);
  return c.body(null, 200);
});

app.get('/local', async (c) => {
  const payload = verifyToken(c.req.query('token') ?? '', 'get');
  if (!payload) {
    throw new HTTPException(403, { message: 'Invalid or expired download token' });
  }
  let data: Buffer;
  try {
    data = await readLocalFile(payload.key);
  } catch {
    throw new HTTPException(404, { message: 'File not found' });
  }
  c.header('Content-Type', payload.mime || 'application/octet-stream');
  return c.body(new Uint8Array(data), 200);
});

/**
 * POST /files/presign-upload
 * Get a presigned PUT URL for uploading a file to S3
 */
app.post(
  '/presign-upload',
  auth,
  zValidator('json', PresignUploadRequestSchema),
  async (c) => {
    const data = c.req.valid('json');
    const result = await fileService.presignUpload(data);
    return c.json(result, 201);
  }
);

/**
 * POST /files/confirm-upload
 * Confirm that a file was successfully uploaded to S3
 */
app.post(
  '/confirm-upload',
  auth,
  zValidator('json', ConfirmUploadRequestSchema),
  async (c) => {
    const { fileId } = c.req.valid('json');
    const file = await fileService.confirmUpload(fileId);
    return c.json({ file });
  }
);

/**
 * POST /files/presign-download
 * Get presigned GET URLs for a batch of file IDs
 */
app.post(
  '/presign-download',
  auth,
  zValidator('json', PresignDownloadRequestSchema),
  async (c) => {
    const { fileIds } = c.req.valid('json');
    const urls = await fileService.presignDownload(fileIds);
    return c.json({ urls });
  }
);

/**
 * GET /files/:id
 * Get file metadata
 */
app.get('/:id', auth, async (c) => {
  const id = parseInt(c.req.param('id') || '');

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid file ID' });
  }

  const file = await fileService.getFileById(id);
  return c.json(file);
});

export default app;
