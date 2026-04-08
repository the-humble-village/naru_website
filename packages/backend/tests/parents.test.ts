// Set up environment variables BEFORE importing anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/naru_test';

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import parentRoutes from '../src/routes/parents';
import { testDb, createTestUser, createTestFamily, createTestParent } from './setup';
import { appConfig } from '../src/config';

// Create test app with parent routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/families/:familyId/parents', parentRoutes);

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

describe('Parent Routes', () => {
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
      email: 'caseworker@test.com',
      login: 'caseworker',
      role: 'CASEWORKER',
    });
    supervisorUser = await createTestUser({
      email: 'supervisor@test.com',
      login: 'supervisor',
      role: 'SUPERVISOR',
    });
    adminUser = await createTestUser({
      email: 'admin@test.com',
      login: 'admin',
      role: 'ADMIN',
    });

    // Create JWT tokens
    caseworkerToken = createTokens(caseworkerUser.id, 'CASEWORKER');
    supervisorToken = createTokens(supervisorUser.id, 'SUPERVISOR');
    adminToken = createTokens(adminUser.id, 'ADMIN');

    // Create a test family
    testFamily = await createTestFamily({
      familyName: 'Test Family',
    });
  });

  describe('GET /families/:familyId/parents', () => {
    it('should return empty array for family with no parents', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/parents`, caseworkerToken);

      expect(response.status).toBe(200);
      const parents = await response.json();
      expect(Array.isArray(parents)).toBe(true);
      expect(parents.length).toBe(0);
    });

    it('should return parents for family with parents', async () => {
      // Create test parents
      const parent1 = await createTestParent(testFamily.id, 'Maria Garcia', 'mother');
      const parent2 = await createTestParent(testFamily.id, 'Juan Garcia', 'father');

      const response = await testClient.get(`/families/${testFamily.id}/parents`, caseworkerToken);

      expect(response.status).toBe(200);
      const parents = await response.json();
      expect(Array.isArray(parents)).toBe(true);
      expect(parents.length).toBe(2);

      // Check parent structure
      const firstParent = parents[0];
      expect(firstParent).toHaveProperty('id');
      expect(firstParent).toHaveProperty('name');
      expect(firstParent).toHaveProperty('role');
      expect(firstParent).toHaveProperty('familyId', testFamily.id);
      expect(firstParent).toHaveProperty('createdAt');
      expect(firstParent).toHaveProperty('updatedAt');
      expect(firstParent).not.toHaveProperty('deletedAt'); // Should never be exposed
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/parents`);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get('/families/999999/parents', caseworkerToken);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /families/:familyId/parents', () => {
    const validParentData = {
      name: 'Maria Garcia',
      role: 'mother',
      birthDate: '1990-05-15T00:00:00Z',
      dateEntered: '2024-01-01T00:00:00Z',
      reasonEnroll: 'First pregnancy, health monitoring',
      notes: 'Needs regular checkups'
    };

    it('should create parent successfully', async () => {
      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        validParentData,
        caseworkerToken
      );

      expect(response.status).toBe(201);
      const parent = await response.json();
      expect(parent).toHaveProperty('id');
      expect(parent.name).toBe(validParentData.name);
      expect(parent.role).toBe(validParentData.role);
      expect(parent.familyId).toBe(testFamily.id);
      expect(parent.birthDate).toBe('1990-05-15T00:00:00.000Z');
      expect(parent.reasonEnroll).toBe(validParentData.reasonEnroll);
      expect(parent.notes).toBe(validParentData.notes);
    });

    it('should create parent with minimal data', async () => {
      const minimalData = {
        name: 'Juan Minimal'
      };

      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        minimalData,
        caseworkerToken
      );

      expect(response.status).toBe(201);
      const parent = await response.json();
      expect(parent.name).toBe(minimalData.name);
      expect(parent.familyId).toBe(testFamily.id);
      expect(parent.role).toBe(null);
      expect(parent.birthDate).toBe(null);
    });

    it('should handle localId for offline sync', async () => {
      const dataWithLocalId = {
        ...validParentData,
        localId: 'ba7f2e8a-9c3d-4e5f-b8a9-c1d2e3f4a5b6'
      };

      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        dataWithLocalId,
        caseworkerToken
      );

      expect(response.status).toBe(201);
      const parent = await response.json();
      expect(parent.localId).toBe(dataWithLocalId.localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = 'ba7f2e8a-9c3d-4e5f-b8a9-c1d2e3f4a5b7';

      // Create first parent
      await createTestParent(testFamily.id, 'First Parent', 'mother', {
        localId
      });

      // Try to create second parent with same localId
      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        { ...validParentData, localId },
        caseworkerToken
      );

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('localId already exists');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        validParentData
      );
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.post(
        '/families/999999/parents',
        validParentData,
        caseworkerToken
      );
      expect(response.status).toBe(404);
    });

    it('should validate request body', async () => {
      const invalidData = {
        name: 'a'.repeat(300), // Too long (max 256)
        role: 'b'.repeat(100), // Too long (max 64)
        birthDate: 'invalid-date'
      };

      const response = await testClient.post(
        `/families/${testFamily.id}/parents`,
        invalidData,
        caseworkerToken
      );

      expect(response.status).toBe(400); // Zod validation error
    });
  });

  describe('GET /families/:familyId/parents/:id', () => {
    let testParent: any;

    beforeEach(async () => {
      testParent = await createTestParent(testFamily.id, 'Test Parent', 'mother');
    });

    it('should return parent successfully', async () => {
      const response = await testClient.get(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        caseworkerToken
      );

      expect(response.status).toBe(200);
      const parent = await response.json();
      expect(parent.id).toBe(testParent.id);
      expect(parent.name).toBe('Test Parent');
      expect(parent.familyId).toBe(testFamily.id);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(
        `/families/${testFamily.id}/parents/${testParent.id}`
      );
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent parent', async () => {
      const response = await testClient.get(
        `/families/${testFamily.id}/parents/999999`,
        caseworkerToken
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 if parent belongs to different family', async () => {
      const otherFamily = await createTestFamily('Other Family');
      const otherParent = await createTestParent(otherFamily.id, 'Other Parent', 'father');

      const response = await testClient.get(
        `/families/${testFamily.id}/parents/${otherParent.id}`,
        caseworkerToken
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /families/:familyId/parents/:id', () => {
    let testParent: any;

    beforeEach(async () => {
      testParent = await createTestParent(testFamily.id, 'Original Name', 'mother');
    });

    it('should update parent successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        role: 'caregiver',
        notes: 'Updated notes'
      };

      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        updateData,
        caseworkerToken
      );

      expect(response.status).toBe(200);
      const updatedParent = await response.json();
      expect(updatedParent.name).toBe(updateData.name);
      expect(updatedParent.role).toBe(updateData.role);
      expect(updatedParent.notes).toBe(updateData.notes);
      expect(updatedParent.id).toBe(testParent.id); // ID should remain the same
    });

    it('should allow partial updates', async () => {
      const partialUpdate = {
        notes: 'Only notes updated'
      };

      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        partialUpdate,
        caseworkerToken
      );

      expect(response.status).toBe(200);
      const updatedParent = await response.json();
      expect(updatedParent.notes).toBe(partialUpdate.notes);
      expect(updatedParent.name).toBe('Original Name'); // Should remain unchanged
    });

    it('should update localId if provided', async () => {
      const newLocalId = 'ca8f3e9a-ad4e-5f6f-c9aa-d2e3f4b5c6d7';
      const updateData = {
        localId: newLocalId
      };

      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        updateData,
        caseworkerToken
      );

      expect(response.status).toBe(200);
      const updatedParent = await response.json();
      expect(updatedParent.localId).toBe(newLocalId);
    });

    it('should reject duplicate localId', async () => {
      const existingLocalId = 'db9f4eaa-be5f-6a7b-daab-e3f4c5d6e7f8';

      // Create another parent with a localId
      await createTestParent(testFamily.id, 'Other Parent', 'father', {
        localId: existingLocalId
      });

      // Try to update our test parent to use the same localId
      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        { localId: existingLocalId },
        caseworkerToken
      );

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('localId already exists');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        { name: 'Updated Name' }
      );
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent parent', async () => {
      const response = await testClient.put(
        `/families/${testFamily.id}/parents/999999`,
        { name: 'Updated Name' },
        caseworkerToken
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 if parent belongs to different family', async () => {
      const otherFamily = await createTestFamily('Other Family');
      const otherParent = await createTestParent(otherFamily.id, 'Other Parent', 'father');

      const response = await testClient.put(
        `/families/${testFamily.id}/parents/${otherParent.id}`,
        { name: 'Updated Name' },
        caseworkerToken
      );
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /families/:familyId/parents/:id', () => {
    let testParent: any;

    beforeEach(async () => {
      testParent = await createTestParent(testFamily.id, 'Test Parent', 'mother');
    });

    it('should delete parent successfully as supervisor', async () => {
      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        supervisorToken
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('deleted successfully');

      // Verify parent is soft-deleted (not accessible via normal queries)
      const getResponse = await testClient.get(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        supervisorToken
      );
      expect(getResponse.status).toBe(404);
    });

    it('should delete parent successfully as admin', async () => {
      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
    });

    it('should return 403 for caseworker (insufficient role)', async () => {
      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/${testParent.id}`,
        caseworkerToken
      );

      expect(response.status).toBe(403);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/${testParent.id}`
      );
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent parent', async () => {
      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/999999`,
        supervisorToken
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 if parent belongs to different family', async () => {
      const otherFamily = await createTestFamily('Other Family');
      const otherParent = await createTestParent(otherFamily.id, 'Other Parent', 'father');

      const response = await testClient.delete(
        `/families/${testFamily.id}/parents/${otherParent.id}`,
        supervisorToken
      );
      expect(response.status).toBe(404);
    });
  });
});
