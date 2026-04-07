// Set up environment variables BEFORE importing anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://postgres@localhost:5432/naru_test';

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import familyVisitsRoutes from '../src/routes/family-visits';
import { testDb, createTestUser, createTestFamily, createTestFamilyVisit } from './setup';
import { appConfig } from '../src/config';

// Create test app with family visits routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

// Mount family visits routes under /families/:familyId/visits
app.route('/families/:familyId/visits', familyVisitsRoutes);

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return app.request(request);
  },

  put: async (path: string, body?: any, accessToken?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return app.request(request);
  },
};

describe('Family Visit Routes', () => {
  let user: any;
  let family: any;
  let accessToken: string;

  beforeEach(async () => {
    // Create test user and family for each test
    user = await createTestUser();
    family = await createTestFamily({ familyName: 'Test Family' });
    accessToken = createTokens(user.id, user.role);
  });

  describe('GET /families/:familyId/visits', () => {
    it('should return empty array for family with no visits', async () => {
      const response = await testClient.get(`/families/${family.id}/visits`, accessToken);
      expect(response.status).toBe(200);

      const visits = await response.json();
      expect(visits).toEqual([]);
    });

    it('should return visits for family with visits', async () => {
      // Create a few family visits
      const visit1 = await createTestFamilyVisit(family.id, {
        notes: 'First visit',
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
      });
      const visit2 = await createTestFamilyVisit(family.id, {
        notes: 'Second visit',
        visitDate: new Date('2024-01-20T10:00:00.000Z'),
      });

      const response = await testClient.get(`/families/${family.id}/visits`, accessToken);
      expect(response.status).toBe(200);

      const visits = await response.json();
      expect(visits).toHaveLength(2);

      // Should be ordered by visitDate desc (most recent first)
      expect(visits[0].notes).toBe('Second visit');
      expect(visits[1].notes).toBe('First visit');

      // Check structure of returned visit
      expect(visits[0]).toMatchObject({
        id: visit2.id,
        familyId: family.id,
        notes: 'Second visit',
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
      });
      expect(visits[0]).not.toHaveProperty('deletedAt');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${family.id}/visits`);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get('/families/99999/visits', accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family not found');
    });

    it('should respect pagination parameters', async () => {
      // Create 3 family visits
      await createTestFamilyVisit(family.id, { notes: 'Visit 1', visitDate: new Date('2024-01-15T10:00:00.000Z') });
      await createTestFamilyVisit(family.id, { notes: 'Visit 2', visitDate: new Date('2024-01-16T10:00:00.000Z') });
      await createTestFamilyVisit(family.id, { notes: 'Visit 3', visitDate: new Date('2024-01-17T10:00:00.000Z') });

      // Test with limit
      const response1 = await testClient.get(`/families/${family.id}/visits?limit=2`, accessToken);
      expect(response1.status).toBe(200);
      const visits1 = await response1.json();
      expect(visits1).toHaveLength(2);

      // Test with skip
      const response2 = await testClient.get(`/families/${family.id}/visits?skip=1&limit=2`, accessToken);
      expect(response2.status).toBe(200);
      const visits2 = await response2.json();
      expect(visits2).toHaveLength(2);

      // Should be different visits due to skip
      expect(visits2[0].id).not.toBe(visits1[0].id);
    });
  });

  describe('POST /families/:familyId/visits', () => {
    it('should create family visit successfully', async () => {
      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
        trainingsReceived: [{ id: 1, title: 'CPR Training' }],
        resourcesReceived: [{ id: 1, title: 'First Aid Kit' }],
        questions: [{ questionId: 1, question: 'How is the family?', answer: 'Good' }],
        notes: 'Family is doing well',
      };

      const response = await testClient.post(`/families/${family.id}/visits`, visitData, accessToken);
      expect(response.status).toBe(201);

      const visit = await response.json();
      expect(visit).toMatchObject({
        familyId: family.id,
        visitDate: '2024-01-15T10:00:00.000Z',
        trainingsReceived: visitData.trainingsReceived,
        resourcesReceived: visitData.resourcesReceived,
        questions: visitData.questions,
        notes: visitData.notes,
      });
      expect(visit).toHaveProperty('id');
      expect(visit).toHaveProperty('createdAt');
      expect(visit).toHaveProperty('updatedAt');
      expect(visit).not.toHaveProperty('deletedAt');
    });

    it('should create family visit with minimal data', async () => {
      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
      };

      const response = await testClient.post(`/families/${family.id}/visits`, visitData, accessToken);
      expect(response.status).toBe(201);

      const visit = await response.json();
      expect(visit).toMatchObject({
        familyId: family.id,
        visitDate: '2024-01-15T10:00:00.000Z',
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
        notes: null,
      });
    });

    it('should handle localId for offline sync', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440000';
      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
        notes: 'Offline-created visit',
        localId,
      };

      const response = await testClient.post(`/families/${family.id}/visits`, visitData, accessToken);
      expect(response.status).toBe(201);

      const visit = await response.json();
      expect(visit.localId).toBe(localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440000';

      // Create first visit with localId
      await createTestFamilyVisit(family.id, { localId });

      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
        localId,
      };

      const response = await testClient.post(`/families/${family.id}/visits`, visitData, accessToken);
      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.message).toBe('Family visit with this localId already exists');
    });

    it('should return 401 without auth token', async () => {
      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
      };

      const response = await testClient.post(`/families/${family.id}/visits`, visitData);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const visitData = {
        visitDate: '2024-01-15T10:00:00.000Z',
      };

      const response = await testClient.post('/families/99999/visits', visitData, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family not found');
    });

    it('should validate request body', async () => {
      const invalidData = {
        visitDate: 'invalid-date',
        trainingsReceived: 'not-an-array',
      };

      const response = await testClient.post(`/families/${family.id}/visits`, invalidData, accessToken);
      expect(response.status).toBe(400); // Zod validation error
    });
  });

  describe('GET /families/:familyId/visits/:id', () => {
    it('should return family visit successfully', async () => {
      const visit = await createTestFamilyVisit(family.id, {
        notes: 'Test visit',
        trainingsReceived: [{ id: 1, title: 'CPR Training' }],
      });

      const response = await testClient.get(`/families/${family.id}/visits/${visit.id}`, accessToken);
      expect(response.status).toBe(200);

      const returnedVisit = await response.json();
      expect(returnedVisit).toMatchObject({
        id: visit.id,
        familyId: family.id,
        notes: 'Test visit',
        trainingsReceived: [{ id: 1, title: 'CPR Training' }],
      });
      expect(returnedVisit).not.toHaveProperty('deletedAt');
    });

    it('should return 401 without auth token', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const response = await testClient.get(`/families/${family.id}/visits/${visit.id}`);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family visit', async () => {
      const response = await testClient.get(`/families/${family.id}/visits/99999`, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family visit not found');
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get('/families/99999/visits/1', accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family not found');
    });

    it('should return 404 for visit from different family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const visit = await createTestFamilyVisit(otherFamily.id);

      const response = await testClient.get(`/families/${family.id}/visits/${visit.id}`, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family visit not found');
    });
  });

  describe('PUT /families/:familyId/visits/:id', () => {
    it('should update family visit successfully', async () => {
      const visit = await createTestFamilyVisit(family.id, {
        notes: 'Original notes',
        trainingsReceived: [],
      });

      const updateData = {
        notes: 'Updated notes',
        trainingsReceived: [{ id: 1, title: 'New Training' }],
        resourcesReceived: [{ id: 2, title: 'Resource Kit' }],
      };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      expect(response.status).toBe(200);

      const updatedVisit = await response.json();
      expect(updatedVisit).toMatchObject({
        id: visit.id,
        familyId: family.id,
        notes: 'Updated notes',
        trainingsReceived: [{ id: 1, title: 'New Training' }],
        resourcesReceived: [{ id: 2, title: 'Resource Kit' }],
      });
      expect(new Date(updatedVisit.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(visit.updatedAt).getTime());
    });

    it('should update specific fields only', async () => {
      const visit = await createTestFamilyVisit(family.id, {
        notes: 'Original notes',
        trainingsReceived: [{ id: 1, title: 'Original Training' }],
      });

      const updateData = {
        notes: 'Updated notes only',
      };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      expect(response.status).toBe(200);

      const updatedVisit = await response.json();
      expect(updatedVisit.notes).toBe('Updated notes only');
      expect(updatedVisit.trainingsReceived).toEqual([{ id: 1, title: 'Original Training' }]); // Should remain unchanged
    });

    it('should update localId if unique', async () => {
      const visit = await createTestFamilyVisit(family.id);
      const newLocalId = '550e8400-e29b-41d4-a716-446655440000';

      const updateData = { localId: newLocalId };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      expect(response.status).toBe(200);

      const updatedVisit = await response.json();
      expect(updatedVisit.localId).toBe(newLocalId);
    });

    it('should reject duplicate localId on update', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440000';

      // Create another visit with the localId we want to use
      await createTestFamilyVisit(family.id, { localId });

      const visit = await createTestFamilyVisit(family.id);
      const updateData = { localId };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.message).toBe('Family visit with this localId already exists');
    });

    it('should return 401 without auth token', async () => {
      const visit = await createTestFamilyVisit(family.id);
      const updateData = { notes: 'Updated notes' };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family visit', async () => {
      const updateData = { notes: 'Updated notes' };

      const response = await testClient.put(`/families/${family.id}/visits/99999`, updateData, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family visit not found');
    });

    it('should return 404 for non-existent family', async () => {
      const updateData = { notes: 'Updated notes' };

      const response = await testClient.put('/families/99999/visits/1', updateData, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family not found');
    });

    it('should return 404 for visit from different family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const visit = await createTestFamilyVisit(otherFamily.id);
      const updateData = { notes: 'Updated notes' };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.message).toBe('Family visit not found');
    });

    it('should validate request body', async () => {
      const visit = await createTestFamilyVisit(family.id);
      const invalidData = {
        visitDate: 'invalid-date',
      };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, invalidData, accessToken);
      expect(response.status).toBe(400); // Zod validation error
    });
  });
});
