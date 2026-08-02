import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { promises as fs } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestParent,
  createTestChild,
  createTestChildVisit,
  createTestFamilyVisit,
  generateTokens,
} from './setup';
import { appConfig } from '../src/config';
import { LocalStorage, LOCAL_STORAGE_DIR, writeLocalFile } from '../src/storage/local';

// Mock the storage driver before importing routes/services so tests exercise
// the file flow without touching S3 or the local filesystem.
const mockStorage = vi.hoisted(() => ({
  getUploadUrl: vi.fn(),
  exists: vi.fn(),
  getDownloadUrl: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../src/storage', () => ({
  getStorage: () => mockStorage,
}));

// Import after mocking
import fileRoutes from '../src/routes/files';

// Create test app with file routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/files', fileRoutes);

// Helper to make requests with auth
const testClient = {
  get: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers,
    });
    return app.request(request);
  },
  post: async (path: string, body?: any, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return app.request(request);
  },
  delete: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers,
    });
    return app.request(request);
  },
};

// Test user and auth token
let testUser: any;
let testToken: string;

// Helper to create a confirmed file in the DB
async function createTestFile(overrides: any = {}) {
  return testDb.file.create({
    data: {
      extension: 'jpg',
      s3Key: `uploads/2024/01/01/test-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      size: 1024,
      confirmed: true,
      ...overrides,
    },
  });
}

describe('File Routes', () => {
  beforeEach(async () => {
    testUser = await createTestUser({
      login: 'testuser',
      email: 'test@example.com',
      role: 'CASEWORKER',
    });

    const tokens = generateTokens(testUser);
    testToken = tokens.accessToken;

    // Reset storage driver mocks to sensible defaults
    mockStorage.getUploadUrl.mockReset().mockResolvedValue('https://s3.example.com/presigned-url');
    mockStorage.getDownloadUrl.mockReset().mockResolvedValue('https://s3.example.com/presigned-url');
    mockStorage.exists.mockReset().mockResolvedValue(true);
    mockStorage.delete.mockReset().mockResolvedValue(undefined);
  });

  describe('POST /files/presign-upload', () => {
    it('should return a presigned upload URL', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }, testToken);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('fileId');
      expect(data).toHaveProperty('uploadUrl');
      expect(data).toHaveProperty('s3Key');
      expect(typeof data.fileId).toBe('number');
      expect(data.uploadUrl).toContain('https://');
      expect(data.s3Key).toContain('uploads/');
    });

    it('should create an unconfirmed file record in the database', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'photo.png',
        mimeType: 'image/png',
        size: 2048,
      }, testToken);

      const data = await response.json();

      const dbFile = await testDb.file.findUnique({ where: { id: data.fileId } });
      expect(dbFile).toBeTruthy();
      expect(dbFile?.confirmed).toBe(false);
      expect(dbFile?.extension).toBe('png');
      expect(dbFile?.mimeType).toBe('image/png');
      expect(dbFile?.size).toBe(2048);
    });

    it('should extract extension from filename', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 5000,
      }, testToken);

      const data = await response.json();
      expect(data.s3Key).toContain('.pdf');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'photo.jpg',
        // Missing mimeType and size
      }, testToken);

      expect(response.status).toBe(400);
    });

    it('should return 400 for files exceeding size limit', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: 'huge.jpg',
        mimeType: 'image/jpeg',
        size: 11 * 1024 * 1024, // 11 MB, exceeds 10 MB limit
      }, testToken);

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty filename', async () => {
      const response = await testClient.post('/files/presign-upload', {
        filename: '',
        mimeType: 'image/jpeg',
        size: 1024,
      }, testToken);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /files/confirm-upload', () => {
    it('should confirm an uploaded file', async () => {
      // Create an unconfirmed file
      const file = await createTestFile({ confirmed: false });

      // File exists in the store
      mockStorage.exists.mockResolvedValueOnce(true);

      const response = await testClient.post('/files/confirm-upload', {
        fileId: file.id,
      }, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.file).toBeDefined();
      expect(data.file.id).toBe(file.id);
      expect(data.file.confirmed).toBe(true);

      // Verify DB was updated
      const dbFile = await testDb.file.findUnique({ where: { id: file.id } });
      expect(dbFile?.confirmed).toBe(true);
    });

    it('should return already confirmed file without re-checking S3', async () => {
      const file = await createTestFile({ confirmed: true });

      const response = await testClient.post('/files/confirm-upload', {
        fileId: file.id,
      }, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.file.confirmed).toBe(true);

      // Store should not have been checked since file is already confirmed
      expect(mockStorage.exists).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent file', async () => {
      const response = await testClient.post('/files/confirm-upload', {
        fileId: 99999,
      }, testToken);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toBe('File not found');
    });

    it('should return 400 if file not found in S3', async () => {
      const file = await createTestFile({ confirmed: false });

      // Store reports the object is missing
      mockStorage.exists.mockResolvedValueOnce(false);

      const response = await testClient.post('/files/confirm-upload', {
        fileId: file.id,
      }, testToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('File not found in S3');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/files/confirm-upload', {
        fileId: 1,
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /files/presign-download', () => {
    it('should return presigned download URLs for confirmed files', async () => {
      const file1 = await createTestFile({ confirmed: true });
      const file2 = await createTestFile({ confirmed: true });

      const response = await testClient.post('/files/presign-download', {
        fileIds: [file1.id, file2.id],
      }, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.urls).toBeDefined();
      expect(data.urls).toHaveLength(2);
      expect(data.urls[0]).toHaveProperty('fileId');
      expect(data.urls[0]).toHaveProperty('url');
      expect(data.urls[1]).toHaveProperty('fileId');
      expect(data.urls[1]).toHaveProperty('url');
    });

    it('should only return URLs for confirmed files', async () => {
      const confirmedFile = await createTestFile({ confirmed: true });
      const unconfirmedFile = await createTestFile({ confirmed: false });

      const response = await testClient.post('/files/presign-download', {
        fileIds: [confirmedFile.id, unconfirmedFile.id],
      }, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Only the confirmed file should have a URL
      expect(data.urls).toHaveLength(1);
      expect(data.urls[0].fileId).toBe(confirmedFile.id);
    });

    it('should return empty array for non-existent file IDs', async () => {
      const response = await testClient.post('/files/presign-download', {
        fileIds: [99999],
      }, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.urls).toHaveLength(0);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/files/presign-download', {
        fileIds: [1],
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 for empty fileIds array', async () => {
      const response = await testClient.post('/files/presign-download', {
        fileIds: [],
      }, testToken);

      expect(response.status).toBe(400);
    });

    it('should return 400 for too many file IDs', async () => {
      const manyIds = Array.from({ length: 51 }, (_, i) => i + 1);
      const response = await testClient.post('/files/presign-download', {
        fileIds: manyIds,
      }, testToken);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /files/:id', () => {
    it('should get file metadata successfully', async () => {
      const file = await createTestFile();

      const response = await testClient.get(`/files/${file.id}`, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(file.id);
      expect(data.extension).toBe('jpg');
      expect(data.mimeType).toBe('image/jpeg');
      expect(data.size).toBe(1024);
      expect(data.confirmed).toBe(true);
      expect(data).toHaveProperty('s3Key');
      expect(data).toHaveProperty('createdAt');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/files/1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await testClient.get('/files/99999', testToken);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toBe('File not found');
    });

    it('should return 400 for invalid file ID', async () => {
      const response = await testClient.get('/files/invalid', testToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Invalid file ID');
    });
  });

  describe('DELETE /files/:id', () => {
    it('should soft-delete the row rather than removing it', async () => {
      const file = await createTestFile();

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);

      // `includeDeleted` opts out of the soft-delete extension — the whole point
      // of this assertion is that the row survived the delete.
      const dbFile = await testDb.file.findUnique({
        where: { id: file.id },
        includeDeleted: true,
      } as any);
      expect(dbFile).toBeTruthy();
      expect(dbFile?.deletedAt).toBeInstanceOf(Date);
    });

    it('should remove the object from the backing store', async () => {
      const file = await createTestFile();

      await testClient.delete(`/files/${file.id}`, testToken);

      expect(mockStorage.delete).toHaveBeenCalledWith(file.s3Key);
    });

    it('should hide a deleted file from GET /:id and presign-download', async () => {
      const file = await createTestFile();

      await testClient.delete(`/files/${file.id}`, testToken);

      const getResponse = await testClient.get(`/files/${file.id}`, testToken);
      expect(getResponse.status).toBe(404);

      const downloadResponse = await testClient.post('/files/presign-download', {
        fileIds: [file.id],
      }, testToken);
      expect(downloadResponse.status).toBe(200);
      expect((await downloadResponse.json()).urls).toHaveLength(0);
    });

    it('should detach the file from every referencing record', async () => {
      const file = await createTestFile();
      const other = await createTestFile();

      const family = await createTestFamily({ photos: [file.id, other.id] });
      const parent = await createTestParent(family.id, 'Photo Parent', 'mother', {
        photos: [file.id],
      });
      const child = await createTestChild(family.id, 'Photo Child', {
        photos: [other.id, file.id],
      });
      const childVisit = await createTestChildVisit(family.id, child.id, {
        photos: [file.id],
      });
      const familyVisit = await createTestFamilyVisit(family.id, { photos: [file.id] });
      const parentVisit = await testDb.parentVisit.create({
        data: {
          familyId: family.id,
          parentId: parent.id,
          visitDate: new Date('2024-02-01T10:00:00.000Z'),
          photos: [file.id],
        },
      });

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);

      // The deleted id is gone everywhere; unrelated ids survive.
      expect((await testDb.family.findUnique({ where: { id: family.id } }))?.photos)
        .toEqual([other.id]);
      expect((await testDb.parent.findUnique({ where: { id: parent.id } }))?.photos)
        .toEqual([]);
      expect((await testDb.child.findUnique({ where: { id: child.id } }))?.photos)
        .toEqual([other.id]);
      expect((await testDb.childVisit.findUnique({ where: { id: childVisit.id } }))?.photos)
        .toEqual([]);
      expect((await testDb.familyVisit.findUnique({ where: { id: familyVisit.id } }))?.photos)
        .toEqual([]);
      expect((await testDb.parentVisit.findUnique({ where: { id: parentVisit.id } }))?.photos)
        .toEqual([]);

      // The other file is untouched.
      const otherFile = await testDb.file.findUnique({ where: { id: other.id } });
      expect(otherFile?.deletedAt).toBeNull();
    });

    it('should leave records that never referenced the file alone', async () => {
      const file = await createTestFile();
      const other = await createTestFile();
      const family = await createTestFamily({ photos: [other.id] });

      await testClient.delete(`/files/${file.id}`, testToken);

      expect((await testDb.family.findUnique({ where: { id: family.id } }))?.photos)
        .toEqual([other.id]);
    });

    it('should succeed when the storage object is already gone', async () => {
      const file = await createTestFile();

      // Both plausible shapes of "already gone": a silent no-op...
      mockStorage.delete.mockResolvedValueOnce(undefined);

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);
      expect((await testDb.file.findUnique({
        where: { id: file.id },
        includeDeleted: true,
      } as any))?.deletedAt).toBeInstanceOf(Date);
    });

    it('should still soft-delete the row when the storage delete throws', async () => {
      const file = await createTestFile();

      // ...and a driver that surfaces the failure. Neither may 500 the request.
      mockStorage.delete.mockRejectedValueOnce(new Error('S3 is down'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);

      const dbFile = await testDb.file.findUnique({
        where: { id: file.id },
        includeDeleted: true,
      } as any);
      expect(dbFile?.deletedAt).toBeInstanceOf(Date);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should return 404 for a non-existent file', async () => {
      const response = await testClient.delete('/files/99999', testToken);

      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe('File not found');
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when deleting an already-deleted file', async () => {
      const file = await createTestFile();

      expect((await testClient.delete(`/files/${file.id}`, testToken)).status).toBe(200);
      expect((await testClient.delete(`/files/${file.id}`, testToken)).status).toBe(404);
    });

    it('should return 400 for an invalid file ID', async () => {
      const response = await testClient.delete('/files/invalid', testToken);

      expect(response.status).toBe(400);
      expect((await response.json()).message).toBe('Invalid file ID');
    });

    it('should return 401 without an auth token', async () => {
      const file = await createTestFile();

      const response = await testClient.delete(`/files/${file.id}`);
      expect(response.status).toBe(401);

      const dbFile = await testDb.file.findUnique({ where: { id: file.id } });
      expect(dbFile?.deletedAt).toBeNull();
    });

    it('should be allowed for supervisors and admins as well as caseworkers', async () => {
      for (const role of ['SUPERVISOR', 'ADMIN'] as const) {
        const user = await createTestUser({
          login: `${role.toLowerCase()}-deleter`,
          email: `${role.toLowerCase()}@example.com`,
          role,
        });
        const file = await createTestFile();

        const response = await testClient.delete(
          `/files/${file.id}`,
          generateTokens(user).accessToken
        );
        expect(response.status).toBe(200);
      }
    });
  });

  // Exercises the real LocalStorage driver (the mock above is bypassed) to prove the
  // bytes actually leave the disk, not just that delete() was called.
  describe('DELETE /files/:id — real local storage', () => {
    const localStorage = new LocalStorage();

    afterAll(async () => {
      await fs.rm(path.join(LOCAL_STORAGE_DIR, 'uploads/2026/08/01'), {
        recursive: true,
        force: true,
      });
    });

    beforeEach(() => {
      mockStorage.delete.mockImplementation((key: string) => localStorage.delete(key));
    });

    it('should remove the file from disk', async () => {
      const s3Key = `uploads/2026/08/01/delete-me-${Date.now()}.jpg`;
      await writeLocalFile(s3Key, Buffer.from('photo-bytes'));
      expect(await localStorage.exists(s3Key)).toBe(true);

      const file = await createTestFile({ s3Key });

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);
      expect(await localStorage.exists(s3Key)).toBe(false);
    });

    it('should succeed when the file is already missing from disk', async () => {
      const s3Key = `uploads/2026/08/01/never-written-${Date.now()}.jpg`;
      expect(await localStorage.exists(s3Key)).toBe(false);

      const file = await createTestFile({ s3Key });

      const response = await testClient.delete(`/files/${file.id}`, testToken);
      expect(response.status).toBe(200);
      expect((await testDb.file.findUnique({
        where: { id: file.id },
        includeDeleted: true,
      } as any))?.deletedAt).toBeInstanceOf(Date);
    });
  });
});
