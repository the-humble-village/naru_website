import { describe, it, expect, afterAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalStorage, LOCAL_STORAGE_DIR, verifyToken } from '../src/storage/local';
import fileRoutes from '../src/routes/files';

// Extract the ?token=... value from a URL produced by the driver
function tokenOf(url: string): string {
  return decodeURIComponent(new URL(url, 'http://localhost').searchParams.get('token') ?? '');
}

const app = new Hono();
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ message: err.message }, err.status);
  return c.json({ message: 'Internal Server Error' }, 500);
});
app.route('/api/files', fileRoutes);

const storage = new LocalStorage();
const KEY = 'uploads/2026/07/26/local-test.jpg';

afterAll(async () => {
  await fs.rm(path.join(LOCAL_STORAGE_DIR, 'uploads/2026/07/26'), { recursive: true, force: true });
});

describe('LocalStorage driver', () => {
  it('signs upload/download URLs pointing at the local endpoint', async () => {
    const uploadUrl = await storage.getUploadUrl(KEY, 'image/jpeg', 1024);
    expect(uploadUrl).toContain('/api/files/local?token=');

    const putToken = verifyToken(tokenOf(uploadUrl), 'put');
    expect(putToken?.key).toBe(KEY);
    // A put token must not be usable for a get
    expect(verifyToken(tokenOf(uploadUrl), 'get')).toBeNull();
  });

  it('rejects tampered tokens', () => {
    expect(verifyToken('garbage.signature', 'put')).toBeNull();
    expect(verifyToken('', 'get')).toBeNull();
  });

  it('round-trips a file through the PUT and GET routes', async () => {
    const bytes = Buffer.from('hello-photo-bytes');

    // exists() is false before upload
    expect(await storage.exists(KEY)).toBe(false);

    // Upload via the presigned PUT URL
    const uploadUrl = await storage.getUploadUrl(KEY, 'image/jpeg', bytes.length);
    const putRes = await app.request('http://localhost' + uploadUrl, {
      method: 'PUT',
      body: bytes,
    });
    expect(putRes.status).toBe(200);
    expect(await storage.exists(KEY)).toBe(true);

    // Download via the presigned GET URL
    const downloadUrl = await storage.getDownloadUrl(KEY, 'image/jpeg');
    const getRes = await app.request('http://localhost' + downloadUrl);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toContain('image/jpeg');
    expect(Buffer.from(await getRes.arrayBuffer()).toString()).toBe('hello-photo-bytes');

    // Delete removes it
    await storage.delete(KEY);
    expect(await storage.exists(KEY)).toBe(false);
  });

  it('rejects the local routes without a valid token', async () => {
    const putRes = await app.request('http://localhost/api/files/local?token=bad', { method: 'PUT', body: 'x' });
    expect(putRes.status).toBe(403);

    const getRes = await app.request('http://localhost/api/files/local?token=bad');
    expect(getRes.status).toBe(403);
  });
});
