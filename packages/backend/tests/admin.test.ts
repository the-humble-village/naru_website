import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import adminRoutes from '../src/routes/admin';
import { testDb, createTestUser } from './setup';
import { appConfig } from '../src/config';

// Create test app with admin routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/admin', adminRoutes);

// Helper to create JWT tokens
const createTokens = (userId: number, role: string, lang: string = 'en') => {
  const accessToken = jwt.sign(
    { userId, role, lang },
    appConfig.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return accessToken;
};

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
  put: async (path: string, body?: any, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'PUT',
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

// Helper to create test lookup entries
const createTestCommunity = async (title: string = 'Test Community') => {
  return testDb.community.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestSite = async (title: string = 'Test Site') => {
  return testDb.site.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestResource = async (title: string = 'Test Resource') => {
  return testDb.resource.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestTraining = async (title: string = 'Test Training') => {
  return testDb.training.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestChildVisitQuestion = async (title: string = 'Test Child Question') => {
  return testDb.childVisitQuestion.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestParentVisitQuestion = async (title: string = 'Test Parent Question') => {
  return testDb.parentVisitQuestion.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

const createTestFamilyVisitQuestion = async (title: string = 'Test Family Question') => {
  return testDb.familyVisitQuestion.create({
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
};

describe('Admin Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // Create test users with different roles
    caseworkerUser = await createTestUser({ email: 'caseworker@test.com', role: 'CASEWORKER' });
    supervisorUser = await createTestUser({ email: 'supervisor@test.com', role: 'SUPERVISOR' });
    adminUser = await createTestUser({ email: 'admin@test.com', role: 'ADMIN' });

    // Create access tokens
    caseworkerToken = createTokens(caseworkerUser.id, caseworkerUser.role);
    supervisorToken = createTokens(supervisorUser.id, supervisorUser.role);
    adminToken = createTokens(adminUser.id, adminUser.role);
  });

  describe('GET /admin/:table', () => {
    it('should return empty array for table with no entries', async () => {
      const response = await testClient.get('/admin/communities', adminToken);
      expect(response.status).toBe(200);
      const communities = await response.json();
      expect(Array.isArray(communities)).toBe(true);
      expect(communities).toHaveLength(0);
    });

    it('should return communities successfully', async () => {
      // Create test communities
      await createTestCommunity('Community A');
      await createTestCommunity('Community B');

      const response = await testClient.get('/admin/communities', adminToken);
      expect(response.status).toBe(200);
      const communities = await response.json();
      expect(Array.isArray(communities)).toBe(true);
      expect(communities).toHaveLength(2);
      expect(communities[0]).toHaveProperty('id');
      expect(communities[0]).toHaveProperty('title');
      expect(communities[0]).toHaveProperty('createdAt');
      expect(communities[0]).toHaveProperty('updatedAt');
      expect(communities[0]).not.toHaveProperty('deletedAt');
    });

    it('should work for all lookup table types', async () => {
      // Test each lookup table type
      const tables = [
        'communities',
        'sites',
        'resources',
        'training',
        'child-visit-questions',
        'parent-visit-questions',
        'family-visit-questions'
      ];

      for (const table of tables) {
        const response = await testClient.get(`/admin/${table}`, adminToken);
        expect(response.status).toBe(200);
        const entries = await response.json();
        expect(Array.isArray(entries)).toBe(true);
      }
    });

    it('should require authentication', async () => {
      const response = await testClient.get('/admin/communities');
      expect(response.status).toBe(401);
    });

    it('should allow any authenticated user to view lookups', async () => {
      // Caseworker should be able to view
      const response1 = await testClient.get('/admin/communities', caseworkerToken);
      expect(response1.status).toBe(200);

      // Supervisor should be able to view
      const response2 = await testClient.get('/admin/communities', supervisorToken);
      expect(response2.status).toBe(200);

      // Admin should be able to view
      const response3 = await testClient.get('/admin/communities', adminToken);
      expect(response3.status).toBe(200);
    });

    it('should return 400 for invalid table name', async () => {
      const response = await testClient.get('/admin/invalid-table', adminToken);
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('Invalid table name');
    });

    it('should return entries ordered by title', async () => {
      // Create communities in reverse alphabetical order
      await createTestCommunity('Zebra Community');
      await createTestCommunity('Alpha Community');
      await createTestCommunity('Beta Community');

      const response = await testClient.get('/admin/communities', adminToken);
      expect(response.status).toBe(200);
      const communities = await response.json();
      expect(communities).toHaveLength(3);
      expect(communities[0].title).toBe('Alpha Community');
      expect(communities[1].title).toBe('Beta Community');
      expect(communities[2].title).toBe('Zebra Community');
    });
  });

  describe('POST /admin/:table', () => {
    it('should create community successfully', async () => {
      const newCommunity = {
        title: 'New Test Community'
      };

      const response = await testClient.post('/admin/communities', newCommunity, adminToken);
      expect(response.status).toBe(201);
      const community = await response.json();
      expect(community.title).toBe(newCommunity.title);
      expect(community).toHaveProperty('id');
      expect(community).toHaveProperty('createdAt');
      expect(community).toHaveProperty('updatedAt');
      expect(community).not.toHaveProperty('deletedAt');
    });

    it('should work for all lookup table types', async () => {
      const testData = [
        { table: 'communities', title: 'Test Community' },
        { table: 'sites', title: 'Test Site' },
        { table: 'resources', title: 'Test Resource' },
        { table: 'training', title: 'Test Training' },
        { table: 'child-visit-questions', title: 'Test Child Question' },
        { table: 'parent-visit-questions', title: 'Test Parent Question' },
        { table: 'family-visit-questions', title: 'Test Family Question' },
      ];

      for (const { table, title } of testData) {
        const response = await testClient.post(`/admin/${table}`, { title }, adminToken);
        expect(response.status).toBe(201);
        const entry = await response.json();
        expect(entry.title).toBe(title);
      }
    });

    it('should require admin role', async () => {
      const newCommunity = { title: 'New Community' };

      // Caseworker should be denied
      const response1 = await testClient.post('/admin/communities', newCommunity, caseworkerToken);
      expect(response1.status).toBe(403);

      // Supervisor should be denied
      const response2 = await testClient.post('/admin/communities', newCommunity, supervisorToken);
      expect(response2.status).toBe(403);

      // Admin should succeed
      const response3 = await testClient.post('/admin/communities', newCommunity, adminToken);
      expect(response3.status).toBe(201);
    });

    it('should require authentication', async () => {
      const newCommunity = { title: 'New Community' };
      const response = await testClient.post('/admin/communities', newCommunity);
      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      // Missing title
      const response1 = await testClient.post('/admin/communities', {}, adminToken);
      expect(response1.status).toBe(400);

      // Empty title
      const response2 = await testClient.post('/admin/communities', { title: '' }, adminToken);
      expect(response2.status).toBe(400);

      // Title too long (over 1024 chars)
      const longTitle = 'x'.repeat(1025);
      const response3 = await testClient.post('/admin/communities', { title: longTitle }, adminToken);
      expect(response3.status).toBe(400);
    });

    it('should reject duplicate titles (case-insensitive)', async () => {
      await createTestCommunity('Test Community');

      // Exact duplicate
      const response1 = await testClient.post('/admin/communities',
        { title: 'Test Community' }, adminToken);
      expect(response1.status).toBe(400);
      const error1 = await response1.json();
      expect(error1.message).toContain('already exists');

      // Case-insensitive duplicate
      const response2 = await testClient.post('/admin/communities',
        { title: 'TEST COMMUNITY' }, adminToken);
      expect(response2.status).toBe(400);
      const error2 = await response2.json();
      expect(error2.message).toContain('already exists');
    });

    it('should return 400 for invalid table name', async () => {
      const response = await testClient.post('/admin/invalid-table',
        { title: 'Test' }, adminToken);
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /admin/:table/:id', () => {
    it('should update community successfully', async () => {
      const community = await createTestCommunity('Original Title');
      const updatedData = { title: 'Updated Title' };

      const response = await testClient.put(`/admin/communities/${community.id}`,
        updatedData, adminToken);
      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.title).toBe(updatedData.title);
      expect(updated.id).toBe(community.id);
    });

    it('should work for all lookup table types', async () => {
      const testData = [
        { table: 'communities', creator: createTestCommunity },
        { table: 'sites', creator: createTestSite },
        { table: 'resources', creator: createTestResource },
        { table: 'training', creator: createTestTraining },
        { table: 'child-visit-questions', creator: createTestChildVisitQuestion },
        { table: 'parent-visit-questions', creator: createTestParentVisitQuestion },
        { table: 'family-visit-questions', creator: createTestFamilyVisitQuestion },
      ];

      for (const { table, creator } of testData) {
        const entry = await creator('Original Title');
        const response = await testClient.put(`/admin/${table}/${entry.id}`,
          { title: 'Updated Title' }, adminToken);
        expect(response.status).toBe(200);
        const updated = await response.json();
        expect(updated.title).toBe('Updated Title');
      }
    });

    it('should require admin role', async () => {
      const community = await createTestCommunity('Test Community');
      const updatedData = { title: 'Updated Title' };

      // Caseworker should be denied
      const response1 = await testClient.put(`/admin/communities/${community.id}`,
        updatedData, caseworkerToken);
      expect(response1.status).toBe(403);

      // Supervisor should be denied
      const response2 = await testClient.put(`/admin/communities/${community.id}`,
        updatedData, supervisorToken);
      expect(response2.status).toBe(403);

      // Admin should succeed
      const response3 = await testClient.put(`/admin/communities/${community.id}`,
        updatedData, adminToken);
      expect(response3.status).toBe(200);
    });

    it('should return 404 for non-existent entry', async () => {
      const response = await testClient.put('/admin/communities/99999',
        { title: 'Updated' }, adminToken);
      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.message).toContain('not found');
    });

    it('should reject duplicate titles (excluding current entry)', async () => {
      const community1 = await createTestCommunity('Community 1');
      const community2 = await createTestCommunity('Community 2');

      // Try to update community2 to have same title as community1
      const response = await testClient.put(`/admin/communities/${community2.id}`,
        { title: 'Community 1' }, adminToken);
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('already exists');
    });

    it('should allow updating to same title (no-op)', async () => {
      const community = await createTestCommunity('Test Community');

      const response = await testClient.put(`/admin/communities/${community.id}`,
        { title: 'Test Community' }, adminToken);
      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.title).toBe('Test Community');
    });

    it('should validate request body', async () => {
      const community = await createTestCommunity('Test Community');

      // Empty title
      const response1 = await testClient.put(`/admin/communities/${community.id}`,
        { title: '' }, adminToken);
      expect(response1.status).toBe(400);

      // Title too long
      const longTitle = 'x'.repeat(1025);
      const response2 = await testClient.put(`/admin/communities/${community.id}`,
        { title: longTitle }, adminToken);
      expect(response2.status).toBe(400);
    });
  });

  describe('DELETE /admin/:table/:id', () => {
    it('should delete community successfully (soft delete)', async () => {
      const community = await createTestCommunity('Test Community');

      const response = await testClient.delete(`/admin/communities/${community.id}`, adminToken);
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('deleted successfully');

      // Verify it's soft deleted (not visible in normal queries due to soft-delete middleware)
      const listResponse = await testClient.get('/admin/communities', adminToken);
      const communities = await listResponse.json();
      expect(communities.find((c: any) => c.id === community.id)).toBeUndefined();
    });

    it('should work for all lookup table types', async () => {
      const testData = [
        { table: 'communities', creator: createTestCommunity },
        { table: 'sites', creator: createTestSite },
        { table: 'resources', creator: createTestResource },
        { table: 'training', creator: createTestTraining },
        { table: 'child-visit-questions', creator: createTestChildVisitQuestion },
        { table: 'parent-visit-questions', creator: createTestParentVisitQuestion },
        { table: 'family-visit-questions', creator: createTestFamilyVisitQuestion },
      ];

      for (const { table, creator } of testData) {
        const entry = await creator('Test Entry');
        const response = await testClient.delete(`/admin/${table}/${entry.id}`, adminToken);
        expect(response.status).toBe(200);
      }
    });

    it('should require admin role', async () => {
      const community = await createTestCommunity('Test Community');

      // Caseworker should be denied
      const response1 = await testClient.delete(`/admin/communities/${community.id}`, caseworkerToken);
      expect(response1.status).toBe(403);

      // Supervisor should be denied
      const response2 = await testClient.delete(`/admin/communities/${community.id}`, supervisorToken);
      expect(response2.status).toBe(403);

      // Admin should succeed
      const response3 = await testClient.delete(`/admin/communities/${community.id}`, adminToken);
      expect(response3.status).toBe(200);
    });

    it('should return 404 for non-existent entry', async () => {
      const response = await testClient.delete('/admin/communities/99999', adminToken);
      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.message).toContain('not found');
    });

    it('should require authentication', async () => {
      const community = await createTestCommunity('Test Community');
      const response = await testClient.delete(`/admin/communities/${community.id}`);
      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid table name', async () => {
      const response = await testClient.delete('/admin/invalid-table/1', adminToken);
      expect(response.status).toBe(400);
    });
  });
});
