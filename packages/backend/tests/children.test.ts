import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import childrenRoutes from '../src/routes/children';
import { testDb, createTestUser, createTestFamily, createTestChild } from './setup';
import { appConfig } from '../src/config';

// Create test app with children routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

// Mount children routes under /families/:familyId/children
app.route('/families/:familyId/children', childrenRoutes);

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

describe('Children Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;
  let testFamily: any;

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

    // Create test family
    testFamily = await createTestFamily({ familyName: 'Children Test Family' });
  });

  describe('GET /families/:familyId/children', () => {
    it('should return empty array for family with no children', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return children for family with children', async () => {
      // Create test children
      await createTestChild(testFamily.id, 'Child One', { sex: 'FEMALE' });
      await createTestChild(testFamily.id, 'Child Two', { sex: 'MALE' });

      const response = await testClient.get(`/families/${testFamily.id}/children`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      // Check child structure
      const child = result[0];
      expect(child.id).toBeDefined();
      expect(child.name).toBeDefined();
      expect(child.birthDate).toBeDefined();
      expect(child.sex).toBeDefined();
      expect(child.weight).toBeDefined();
      expect(child.familyId).toBe(testFamily.id);
      expect(child.createdAt).toBeDefined();
      expect(child.updatedAt).toBeDefined();
      expect(child.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get('/families/99999/children', caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Family not found');
      }
    });
  });

  describe('POST /families/:familyId/children', () => {
    it('should create child successfully', async () => {
      const childData = {
        name: 'New Test Child',
        birthDate: '2022-06-15T00:00:00.000Z',
        sex: 'FEMALE' as const,
        weight: 12, // kg
        nutritionalState: 'Normal',
        reasonEnrollment: 'Routine monitoring',
        observations: 'Healthy child',
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.name).toBe(childData.name);
      expect(result.birthDate).toBe(childData.birthDate);
      expect(result.sex).toBe(childData.sex);
      expect(result.weight).toBe(childData.weight);
      expect(result.nutritionalState).toBe(childData.nutritionalState);
      expect(result.familyId).toBe(testFamily.id);

      // Verify in database
      const dbChild = await testDb.child.findUnique({
        where: { id: result.id },
      });
      expect(dbChild).toBeTruthy();
      expect(dbChild?.name).toBe(childData.name);
    });

    it('should create child with minimal data', async () => {
      const childData = {
        name: 'Minimal Child',
        birthDate: '2023-01-01T00:00:00.000Z',
        sex: 'MALE' as const,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.name).toBe(childData.name);
      expect(result.weight).toBe(0); // Default value
      expect(result.nutritionalState).toBeNull();
    });

    it('should handle localId for offline sync', async () => {
      const childData = {
        name: 'Offline Child',
        birthDate: '2022-12-25T00:00:00.000Z',
        sex: 'FEMALE' as const,
        localId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.localId).toBe(childData.localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440001';

      // Create first child
      await createTestChild(testFamily.id, 'First Child', { localId });

      const childData = {
        name: 'Duplicate LocalId Child',
        birthDate: '2022-05-01T00:00:00.000Z',
        sex: 'MALE' as const,
        localId,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, childData, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should return 401 without auth token', async () => {
      const childData = {
        name: 'Unauthorized Child',
        birthDate: '2022-01-01T00:00:00.000Z',
        sex: 'MALE' as const,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, childData);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const childData = {
        name: 'Orphan Child',
        birthDate: '2022-01-01T00:00:00.000Z',
        sex: 'FEMALE' as const,
      };

      const response = await testClient.post('/families/99999/children', childData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should validate request body', async () => {
      const invalidChildData = {
        name: 'Invalid Child',
        // Missing required birthDate and sex
      };

      const response = await testClient.post(`/families/${testFamily.id}/children`, invalidChildData, caseworkerToken);

      expect(response.status).toBe(400); // Validation error
    });
  });

  describe('GET /families/:familyId/children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild(testFamily.id, 'Detail Test Child', {
        sex: 'MALE',
        weight: 18, // kg
        birthDate: new Date('2020-01-15'), // About 4 years old
      });
    });

    it('should return child with z-score calculation', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testChild.id);
      expect(result.name).toBe(testChild.name);
      expect(result.sex).toBe(testChild.sex);
      expect(result.weight).toBe(testChild.weight);
      expect(result.familyId).toBe(testFamily.id);
      expect(result.deletedAt).toBeUndefined(); // Should not be exposed

      // Check z-score calculation
      expect(result.zScores).toBeDefined();
      expect(result.zScores.ageInDays).toBeDefined();
      expect(typeof result.zScores.ageInDays).toBe('number');

      if (result.zScores.weightForAge) {
        expect(result.zScores.weightForAge.zScore).toBeDefined();
        expect(result.zScores.weightForAge.classification).toBeDefined();
        expect(['severe', 'moderate', 'mild', 'normal', 'above', 'high']).toContain(
          result.zScores.weightForAge.classification
        );
      }
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/99999`, caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Child not found');
      }
    });

    it('should return 404 for child in wrong family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const otherChild = await createTestChild(otherFamily.id, 'Other Child');

      const response = await testClient.get(`/families/${testFamily.id}/children/${otherChild.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get(`/families/99999/children/${testChild.id}`, caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Family not found');
      }
    });
  });

  describe('PUT /families/:familyId/children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild(testFamily.id, 'Update Test Child', {
        sex: 'FEMALE',
        weight: 15,
      });
    });

    it('should update child successfully', async () => {
      const updateData = {
        name: 'Updated Child Name',
        weight: 20,
        nutritionalState: 'Improved',
        observations: 'Updated observations',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testChild.id);
      expect(result.name).toBe(updateData.name);
      expect(result.weight).toBe(updateData.weight);
      expect(result.nutritionalState).toBe(updateData.nutritionalState);
      expect(result.observations).toBe(updateData.observations);

      // Verify in database
      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.name).toBe(updateData.name);
      expect(dbChild?.weight).toBe(updateData.weight);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        weight: 25, // Only update weight
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.name).toBe(testChild.name); // Unchanged
      expect(result.weight).toBe(updateData.weight); // Updated
    });

    it('should update localId if provided', async () => {
      const updateData = {
        localId: '661f9511-f30c-52e5-b827-557766551111',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.localId).toBe(updateData.localId);
    });

    it('should reject duplicate localId on update', async () => {
      const existingLocalId = '772a0622-042d-63f6-c938-668877662222';

      // Create another child with a localId
      await createTestChild(testFamily.id, 'Other Child', { localId: existingLocalId });

      const updateData = {
        localId: existingLocalId,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}`, updateData, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should return 404 for non-existent child', async () => {
      const updateData = {
        name: 'Non-existent Child',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/99999`, updateData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}`, updateData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /families/:familyId/children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild(testFamily.id, 'Delete Test Child');
    });

    it('should soft delete child for supervisor', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}`, supervisorToken);

      expect(response.status).toBe(200);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('deleted successfully');
      }

      // Verify soft delete in database
      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeTruthy(); // Should be soft deleted
    });

    it('should soft delete child for admin', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}`, adminToken);

      expect(response.status).toBe(200);

      // Verify soft delete in database
      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeTruthy(); // Should be soft deleted
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}`, caseworkerToken);

      expect(response.status).toBe(403);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Access denied');
      }

      // Verify child was NOT deleted
      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeNull(); // Should NOT be deleted
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/99999`, supervisorToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}`);

      expect(response.status).toBe(401);
    });
  });
});
