import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import birthingAssistantRoutes from '../src/routes/birthing-assistants';
import { testDb, createTestUser, createTestCommunity, createTestTraining } from './setup';
import { appConfig } from '../src/config';

// Create test app with birthing assistants routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/birthing-assistants', birthingAssistantRoutes);

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

describe('Birthing Assistant Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // Create test users
    caseworkerUser = await createTestUser({
      login: 'caseworker',
      role: 'CASEWORKER',
    });
    supervisorUser = await createTestUser({
      login: 'supervisor',
      role: 'SUPERVISOR',
    });
    adminUser = await createTestUser({
      login: 'admin',
      role: 'ADMIN',
    });

    // Create tokens
    caseworkerToken = createTokens(caseworkerUser.id, caseworkerUser.role);
    supervisorToken = createTokens(supervisorUser.id, supervisorUser.role);
    adminToken = createTokens(adminUser.id, adminUser.role);
  });

  describe('GET /birthing-assistants', () => {
    it('should return empty array when no birthing assistants exist', async () => {
      const response = await testClient.get('/birthing-assistants', caseworkerToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('should return birthing assistants with communities and trainings', async () => {
      // Create test community and training
      const community = await createTestCommunity({ title: 'Test Community' });
      const training = await createTestTraining('Test Training');

      // Create a birthing assistant with associations
      await testClient.post('/birthing-assistants', {
        name: 'Test BA',
        communityIds: [community.id],
        trainingIds: [training.id],
      }, supervisorToken);

      const response = await testClient.get('/birthing-assistants', caseworkerToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        name: 'Test BA',
        servedCommunities: [
          { id: community.id, title: 'Test Community' }
        ],
        trainingsReceived: [
          { id: training.id, title: 'Test Training' }
        ],
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/birthing-assistants');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /birthing-assistants', () => {
    it('should create birthing assistant successfully (supervisor)', async () => {
      const community = await createTestCommunity({ title: 'Test Community' });
      const training = await createTestTraining('Test Training');

      const response = await testClient.post('/birthing-assistants', {
        name: 'New BA',
        communityIds: [community.id],
        trainingIds: [training.id],
      }, supervisorToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject({
        name: 'New BA',
        servedCommunities: [
          { id: community.id, title: 'Test Community' }
        ],
        trainingsReceived: [
          { id: training.id, title: 'Test Training' }
        ],
      });
      expect(data.id).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it('should create birthing assistant with minimal data', async () => {
      const response = await testClient.post('/birthing-assistants', {
        name: 'Minimal BA',
      }, supervisorToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject({
        name: 'Minimal BA',
        servedCommunities: [],
        trainingsReceived: [],
      });
    });

    it('should handle localId for offline sync', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await testClient.post('/birthing-assistants', {
        name: 'Offline BA',
        localId,
      }, supervisorToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.localId).toBe(localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440000';

      // Create first birthing assistant
      await testClient.post('/birthing-assistants', {
        name: 'First BA',
        localId,
      }, supervisorToken);

      // Try to create second with same localId
      const response = await testClient.post('/birthing-assistants', {
        name: 'Second BA',
        localId,
      }, supervisorToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('localId already exists');
    });

    it('should return 400 for non-existent community', async () => {
      const response = await testClient.post('/birthing-assistants', {
        name: 'Test BA',
        communityIds: [99999],
      }, supervisorToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('communities do not exist');
    });

    it('should return 400 for non-existent training', async () => {
      const response = await testClient.post('/birthing-assistants', {
        name: 'Test BA',
        trainingIds: [99999],
      }, supervisorToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('trainings do not exist');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/birthing-assistants', {
        name: 'Test BA',
      });
      expect(response.status).toBe(401);
    });

    it('should return 403 for caseworker role', async () => {
      const response = await testClient.post('/birthing-assistants', {
        name: 'Test BA',
      }, caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should validate request body', async () => {
      const response = await testClient.post('/birthing-assistants', {}, supervisorToken);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /birthing-assistants/:id', () => {
    it('should return birthing assistant successfully', async () => {
      const community = await createTestCommunity({ title: 'Test Community' });

      // Create birthing assistant
      const createResponse = await testClient.post('/birthing-assistants', {
        name: 'Test BA',
        communityIds: [community.id],
      }, supervisorToken);
      const created = await createResponse.json();

      const response = await testClient.get(`/birthing-assistants/${created.id}`, caseworkerToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: created.id,
        name: 'Test BA',
        servedCommunities: [
          { id: community.id, title: 'Test Community' }
        ],
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/birthing-assistants/1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent birthing assistant', async () => {
      const response = await testClient.get('/birthing-assistants/99999', caseworkerToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /birthing-assistants/:id', () => {
    it('should update birthing assistant successfully (supervisor)', async () => {
      const community1 = await createTestCommunity({ title: 'Community 1' });
      const community2 = await createTestCommunity({ title: 'Community 2' });
      const training = await createTestTraining('Test Training');

      // Create birthing assistant
      const createResponse = await testClient.post('/birthing-assistants', {
        name: 'Original BA',
        communityIds: [community1.id],
      }, supervisorToken);
      const created = await createResponse.json();

      const response = await testClient.put(`/birthing-assistants/${created.id}`, {
        name: 'Updated BA',
        communityIds: [community2.id],
        trainingIds: [training.id],
      }, supervisorToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: created.id,
        name: 'Updated BA',
        servedCommunities: [
          { id: community2.id, title: 'Community 2' }
        ],
        trainingsReceived: [
          { id: training.id, title: 'Test Training' }
        ],
      });
    });

    it('should update partial fields', async () => {
      // Create birthing assistant
      const createResponse = await testClient.post('/birthing-assistants', {
        name: 'Original BA',
      }, supervisorToken);
      const created = await createResponse.json();

      const response = await testClient.put(`/birthing-assistants/${created.id}`, {
        name: 'Updated Name Only',
      }, supervisorToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Name Only');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.put('/birthing-assistants/1', {
        name: 'Updated BA',
      });
      expect(response.status).toBe(401);
    });

    it('should return 403 for caseworker role', async () => {
      const response = await testClient.put('/birthing-assistants/1', {
        name: 'Updated BA',
      }, caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent birthing assistant', async () => {
      const response = await testClient.put('/birthing-assistants/99999', {
        name: 'Updated BA',
      }, supervisorToken);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /birthing-assistants/:id', () => {
    it('should delete birthing assistant successfully (supervisor)', async () => {
      // Create birthing assistant
      const createResponse = await testClient.post('/birthing-assistants', {
        name: 'To Delete BA',
      }, supervisorToken);
      const created = await createResponse.json();

      const response = await testClient.delete(`/birthing-assistants/${created.id}`, supervisorToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Birthing assistant deleted successfully');

      // Verify it's actually soft deleted (check that deletedAt is set)
      const deletedRecord = await testDb.birthingAssistant.findFirst({
        where: { id: created.id, deletedAt: { not: null } }
      });
      expect(deletedRecord).not.toBeNull();
      expect(deletedRecord?.deletedAt).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.delete('/birthing-assistants/1');
      expect(response.status).toBe(401);
    });

    it('should return 403 for caseworker role', async () => {
      const response = await testClient.delete('/birthing-assistants/1', caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent birthing assistant', async () => {
      const response = await testClient.delete('/birthing-assistants/99999', supervisorToken);
      expect(response.status).toBe(404);
    });
  });
});
