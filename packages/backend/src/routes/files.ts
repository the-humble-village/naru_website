import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { auth } from '../middleware/auth.js';
import * as fileService from '../services/file.service.js';
import { HTTPException } from 'hono/http-exception';
import {
  PresignUploadRequestSchema,
  ConfirmUploadRequestSchema,
  PresignDownloadRequestSchema,
} from '@naru/shared';

const app = new Hono();

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
