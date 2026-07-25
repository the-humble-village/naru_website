import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { testDb, createTestUser, generateTokens } from './setup';
import { appConfig } from '../src/config';

// Mock S3 before importing routes/services
vi.mock('../src/s3', () => ({
  s3: {
    send: vi.fn(),
  },
  BUCKET: 'test-bucket',
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

// Import after mocking
import fileRoutes from '../src/routes/files';
import { s3 } from '../src/s3';

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

    // Reset mocks
    vi.mocked(s3.send).mockReset();
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

      // Mock S3 HeadObject to succeed (file exists)
      vi.mocked(s3.send).mockResolvedValueOnce({} as any);

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

      // S3 should not have been called since file is already confirmed
      expect(s3.send).not.toHaveBeenCalled();
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

      // Mock S3 HeadObject to fail (file doesn't exist)
      vi.mocked(s3.send).mockRejectedValueOnce(new Error('Not Found'));

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
});
