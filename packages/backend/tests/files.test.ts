import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fileRoutes from '../src/routes/files';
import { testDb, createTestUser, generateTokens } from './setup';
import { appConfig } from '../src/config';

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
  post: async (path: string, body?: FormData | any, accessToken?: string, isFormData: boolean = false) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (!isFormData && body) {
      headers['Content-Type'] = 'application/json';
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });
    return app.request(request);
  },
};

// Test user and auth token - will be set up in beforeEach
let testUser: any;
let testToken: string;

// Create test file data
function createTestFile(content: string = 'test file content'): { buffer: Buffer; formData: FormData } {
  const buffer = Buffer.from(content);
  const blob = new Blob([buffer], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });

  const formData = new FormData();
  formData.append('file', file);

  return { buffer, formData };
}

describe('File Routes', () => {
  beforeEach(async () => {
    // Create test user (setup.ts beforeEach already cleans the database)
    testUser = await createTestUser({
      login: 'testuser',
      email: 'test@example.com',
      role: 'CASEWORKER',
    });

    // Generate auth token for the user
    const tokens = generateTokens(testUser);
    testToken = tokens.accessToken;
  });

  describe('POST /files', () => {
    it('should upload file successfully', async () => {
      const { formData } = createTestFile('hello world');

      const response = await testClient.post('/files', formData, testToken, true);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('file');
      expect(data).toHaveProperty('url');
      expect(data).toHaveProperty('wasDeduped');
      expect(data.wasDeduped).toBe(false);
      expect(data.file.extension).toBe('txt');
      expect(data.url).toMatch(/\/api\/files\/\d+\/download/);
    });

    it('should deduplicate identical files', async () => {
      const content = 'duplicate test content';
      const { formData: formData1 } = createTestFile(content);
      const { formData: formData2 } = createTestFile(content);

      // Upload first file
      const response1 = await testClient.post('/files', formData1, testToken, true);

      expect(response1.status).toBe(201);
      const data1 = await response1.json();
      expect(data1.wasDeduped).toBe(false);

      // Upload second identical file
      const response2 = await testClient.post('/files', formData2, testToken, true);

      expect(response2.status).toBe(201);
      const data2 = await response2.json();
      expect(data2.wasDeduped).toBe(true);
      expect(data2.file.id).toBe(data1.file.id);
      expect(data2.file.hash).toBe(data1.file.hash);
    });

    it('should handle files with different extensions', async () => {
      const buffer = Buffer.from('image data');
      const blob = new Blob([buffer], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await testClient.post('/files', formData, testToken, true);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.file.extension).toBe('png');
    });

    it('should return 401 without auth token', async () => {
      const { formData } = createTestFile();

      const response = await testClient.post('/files', formData, undefined, true);

      expect(response.status).toBe(401);
    });

    it('should return 400 with no file', async () => {
      const formData = new FormData();

      const response = await testClient.post('/files', formData, testToken, true);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('No file provided');
    });

    it('should return 400 for files too large', async () => {
      // Create a large file (11MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const buffer = Buffer.from(largeContent);
      const blob = new Blob([buffer], { type: 'text/plain' });
      const file = new File([blob], 'large.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await testClient.post('/files', formData, testToken, true);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('File too large');
    });
  });

  describe('GET /files/:id', () => {
    it('should get file metadata successfully', async () => {
      // Upload a file first
      const { formData } = createTestFile('metadata test');

      const uploadResponse = await testClient.post('/files', formData, testToken, true);

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.file.id;

      // Get file metadata
      const response = await testClient.get(`/files/${fileId}`, testToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(fileId);
      expect(data.extension).toBe('txt');
      expect(data).toHaveProperty('hash');
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

  describe('GET /files/:id/download', () => {
    it('should return 501 for download (not implemented)', async () => {
      // Upload a file first
      const { formData } = createTestFile('download test');

      const uploadResponse = await testClient.post('/files', formData, testToken, true);

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.file.id;

      // Try to download file
      const response = await testClient.get(`/files/${fileId}/download`, testToken);

      // Should return 501 because file storage is not implemented yet
      expect(response.status).toBe(501);
      const data = await response.json();
      expect(data.message).toContain('not implemented');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/files/1/download');
      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid file ID', async () => {
      const response = await testClient.get('/files/invalid/download', testToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Invalid file ID');
    });
  });

  describe('SHA-256 hash calculation', () => {
    it('should calculate correct hash for known content', async () => {
      const content = 'hello world';
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      const { formData } = createTestFile(content);

      const response = await testClient.post('/files', formData, testToken, true);

      const data = await response.json();
      expect(data.file.hash).toBe(expectedHash);
    });

    it('should generate different hashes for different content', async () => {
      const { formData: formData1 } = createTestFile('content 1');
      const { formData: formData2 } = createTestFile('content 2');

      const response1 = await testClient.post('/files', formData1, testToken, true);

      const response2 = await testClient.post('/files', formData2, testToken, true);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.file.hash).not.toBe(data2.file.hash);
      expect(data1.file.id).not.toBe(data2.file.id);
      expect(data1.wasDeduped).toBe(false);
      expect(data2.wasDeduped).toBe(false);
    });
  });
});
