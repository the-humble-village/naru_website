import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import familiesRoutes from '../src/routes/families';
import { testDb, createTestUser, createTestFamily, createTestCommunity } from './setup';
import { appConfig } from '../src/config';

// Create test app with family routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/families', familiesRoutes);

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

describe('Family Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;
  let testCommunity: any;

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

    // Create test community for filtering tests
    testCommunity = await createTestCommunity();
  });

  describe('GET /families', () => {
    it('should list families for authenticated users', async () => {
      // Create test families
      await createTestFamily({ familyName: 'Family One' });
      await createTestFamily({ familyName: 'Family Two', inCrisis: true });

      const response = await testClient.get('/families', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.families).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.families.length).toBe(2);
      expect(result.total).toBe(2);

      // Check family structure
      const family = result.families[0];
      expect(family.id).toBeDefined();
      expect(family.familyName).toBeDefined();
      expect(family.childrenEditable).toBeDefined();
      expect(family.inCrisis).toBeDefined();
      expect(family.createdAt).toBeDefined();
      expect(family.updatedAt).toBeDefined();
      expect(family.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should support search filtering', async () => {
      await createTestFamily({ familyName: 'Smith Family' });
      await createTestFamily({ familyName: 'Jones Family' });

      const response = await testClient.get('/families?search=Smith', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.families.length).toBe(1);
      expect(result.families[0].familyName).toBe('Smith Family');
    });

    it('should support community filtering', async () => {
      await createTestFamily({
        familyName: 'Community Family',
        communityId: testCommunity.id
      });
      await createTestFamily({ familyName: 'No Community Family' });

      const response = await testClient.get(`/families?communityId=${testCommunity.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.families.length).toBe(1);
      expect(result.families[0].communityId).toBe(testCommunity.id);
    });

    it('should support crisis filtering', async () => {
      await createTestFamily({ familyName: 'Crisis Family', inCrisis: true });
      await createTestFamily({ familyName: 'Normal Family', inCrisis: false });

      const response = await testClient.get('/families?inCrisis=true', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.families.length).toBe(1);
      expect(result.families[0].inCrisis).toBe(true);
    });

    it('should support pagination', async () => {
      // Create multiple families
      for (let i = 0; i < 5; i++) {
        await createTestFamily({ familyName: `Family ${i}` });
      }

      const response = await testClient.get('/families?skip=2&limit=2', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.families.length).toBe(2);
      expect(result.total).toBe(5);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.get('/families');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /families', () => {
    it('should create a family successfully', async () => {
      const familyData = {
        familyName: 'New Test Family',
        childrenEditable: 2,
        inCrisis: true,
        notes: 'Test notes',
        communityId: testCommunity.id,
      };

      const response = await testClient.post('/families', familyData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.familyName).toBe(familyData.familyName);
      expect(result.childrenEditable).toBe(familyData.childrenEditable);
      expect(result.inCrisis).toBe(familyData.inCrisis);
      expect(result.notes).toBe(familyData.notes);
      expect(result.communityId).toBe(familyData.communityId);

      // Verify in database
      const dbFamily = await testDb.family.findUnique({
        where: { id: result.id },
      });
      expect(dbFamily).toBeTruthy();
      expect(dbFamily?.familyName).toBe(familyData.familyName);
    });

    it('should create a family with minimal data', async () => {
      const familyData = {
        familyName: 'Minimal Family',
      };

      const response = await testClient.post('/families', familyData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.familyName).toBe(familyData.familyName);
      expect(result.childrenEditable).toBe(0); // Default value
      expect(result.inCrisis).toBe(false); // Default value
    });

    it('should handle localId for offline sync', async () => {
      const familyData = {
        familyName: 'Offline Family',
        localId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const response = await testClient.post('/families', familyData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.localId).toBe(familyData.localId);
    });

    it('should return 400 for duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440001';

      // Create first family
      await createTestFamily({ localId });

      const familyData = {
        familyName: 'Duplicate LocalId Family',
        localId,
      };

      const response = await testClient.post('/families', familyData, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should allow creating families with minimal data (empty object)', async () => {
      const response = await testClient.post('/families', {
        // Empty object is valid - all fields are optional with defaults
      }, caseworkerToken);

      expect(response.status).toBe(201);

      const result = await response.json();
      expect(result.id).toBeDefined();
      expect(result.familyName).toBeNull();
      expect(result.childrenEditable).toBe(0); // Default value
      expect(result.inCrisis).toBe(false); // Default value
    });

    it('should return 401 for unauthenticated requests', async () => {
      const familyData = {
        familyName: 'Unauthorized Family',
      };

      const response = await testClient.post('/families', familyData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /families/:id', () => {
    let testFamily: any;

    beforeEach(async () => {
      testFamily = await createTestFamily({
        familyName: 'Detail Test Family',
        communityId: testCommunity.id,
      });
    });

    it('should get family by ID', async () => {
      const response = await testClient.get(`/families/${testFamily.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testFamily.id);
      expect(result.familyName).toBe(testFamily.familyName);
      expect(result.communityId).toBe(testCommunity.id);
      expect(result.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get('/families/99999', caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('not found');
      }
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.get(`/families/${testFamily.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /families/:id', () => {
    let testFamily: any;

    beforeEach(async () => {
      testFamily = await createTestFamily({
        familyName: 'Update Test Family',
        inCrisis: false,
      });
    });

    it('should update family successfully', async () => {
      const updateData = {
        familyName: 'Updated Family Name',
        inCrisis: true,
        notes: 'Updated notes',
      };

      const response = await testClient.put(`/families/${testFamily.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testFamily.id);
      expect(result.familyName).toBe(updateData.familyName);
      expect(result.inCrisis).toBe(updateData.inCrisis);
      expect(result.notes).toBe(updateData.notes);

      // Verify in database
      const dbFamily = await testDb.family.findUnique({
        where: { id: testFamily.id },
        includeDeleted: true,
      } as any);
      expect(dbFamily?.familyName).toBe(updateData.familyName);
      expect(dbFamily?.inCrisis).toBe(updateData.inCrisis);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        inCrisis: true, // Only update crisis flag
      };

      const response = await testClient.put(`/families/${testFamily.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.familyName).toBe(testFamily.familyName); // Unchanged
      expect(result.inCrisis).toBe(true); // Updated
    });

    it('should return 404 for non-existent family', async () => {
      const updateData = {
        familyName: 'Non-existent Family',
      };

      const response = await testClient.put('/families/99999', updateData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const updateData = {
        familyName: 'Unauthorized Update',
      };

      const response = await testClient.put(`/families/${testFamily.id}`, updateData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /families/:id', () => {
    let testFamily: any;

    beforeEach(async () => {
      testFamily = await createTestFamily({
        familyName: 'Delete Test Family',
      });
    });

    it('should soft delete family for supervisor', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}`, supervisorToken);

      expect(response.status).toBe(200);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('deleted successfully');
      }

      // Verify soft delete in database
      const dbFamily = await testDb.family.findUnique({
        where: { id: testFamily.id },
        includeDeleted: true,
      } as any);
      expect(dbFamily?.deletedAt).toBeTruthy(); // Should be soft deleted
    });

    it('should soft delete family for admin', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}`, adminToken);

      expect(response.status).toBe(200);

      // Verify soft delete in database
      const dbFamily = await testDb.family.findUnique({
        where: { id: testFamily.id },
        includeDeleted: true,
      } as any);
      expect(dbFamily?.deletedAt).toBeTruthy(); // Should be soft deleted
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}`, caseworkerToken);

      expect(response.status).toBe(403);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Access denied');
      }

      // Verify family was NOT deleted
      const dbFamily = await testDb.family.findUnique({
        where: { id: testFamily.id },
        includeDeleted: true,
      } as any);
      expect(dbFamily?.deletedAt).toBeNull(); // Should NOT be deleted
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.delete('/families/99999', supervisorToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}`);

      expect(response.status).toBe(401);
    });
  });
});
