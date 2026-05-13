import { Hono } from 'hono';
import { auth } from '../middleware/auth.js';
import * as fileService from '../services/file.service.js';
import { HTTPException } from 'hono/http-exception';

const app = new Hono();

/**
 * POST /files
 * Upload a file (multipart/form-data)
 * Implements SHA-256 deduplication
 */
app.post('/', auth, async (c) => {
  try {
    // Parse multipart form data
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      throw new HTTPException(400, { message: 'No file provided or invalid file field' });
    }

    // Hono File object has arrayBuffer() method
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      throw new HTTPException(400, { message: 'File too large (max 10MB)' });
    }

    // Get original filename
    const originalFilename = file.name || 'unnamed';

    // Store file with deduplication
    const result = await fileService.storeFile(buffer, originalFilename);

    return c.json(result, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'File upload failed' });
  }
});

/**
 * GET /files/:id
 * Get file metadata
 */
app.get('/:id', auth, async (c) => {
  const idParam = c.req.param('id');
  const id = parseInt(idParam || '');

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid file ID' });
  }

  const file = await fileService.getFileById(id);
  return c.json(file);
});

/**
 * GET /files/:id/download
 * Download file binary data
 */
app.get('/:id/download', auth, async (c) => {
  const idParam = c.req.param('id');
  const id = parseInt(idParam || '');

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid file ID' });
  }

  try {
    const { buffer, extension } = await fileService.getFileBinary(id);

    // Set appropriate headers for file download
    c.header('Content-Type', getContentType(extension));
    c.header('Content-Length', buffer.length.toString());
    c.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year (content-addressed)

    return c.body(new Uint8Array(buffer));
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'File download failed' });
  }
});

/**
 * Get MIME content type from file extension
 */
function getContentType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

export default app;