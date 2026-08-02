import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import familyVisitRoutes from '../src/routes/family-visits';
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
app.route('/families/:familyId/visits', familyVisitRoutes);

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

describe('Family Visit Routes', () => {
  let user: any;
  let supervisorUser: any;
  let adminUser: any;
  let family: any;
  let accessToken: string;
  let supervisorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // Create test users and family for each test
    user = await createTestUser();
    supervisorUser = await createTestUser({
      login: 'supervisor',
      email: 'supervisor@example.com',
      role: 'SUPERVISOR',
    });
    adminUser = await createTestUser({
      login: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    family = await createTestFamily({ familyName: 'Test Family' });
    accessToken = createTokens(user.id, user.role);
    supervisorToken = createTokens(supervisorUser.id, supervisorUser.role);
    adminToken = createTokens(adminUser.id, adminUser.role);
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

    // Regression: these columns were reachable through the schema but had no coverage,
    // so nothing proved the service actually wrote them.
    it('should update every mutable field in a single request', async () => {
      const visit = await createTestFamilyVisit(family.id);
      const updateData = {
        visitDate: '2024-07-04T09:15:00.000Z',
        trainingsReceived: [{ id: 1, title: 'Nutrition basics' }],
        resourcesReceived: [
          { id: 2, title: 'Water filter' },
          { id: 3, title: 'Mosquito net' },
        ],
        questions: [{ questionId: 9, question: 'Clean water?', answer: 'Yes' }],
        photos: [31, 32],
        notes: 'Everything updated',
        localId: '994c2844-264f-85b8-eb5a-88aa99884444',
      };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject(updateData);

      // Verify every field actually persisted, not just echoed back
      const dbVisit = await testDb.familyVisit.findUnique({ where: { id: visit.id } });
      expect(dbVisit?.visitDate.toISOString()).toBe(updateData.visitDate);
      expect(dbVisit?.trainingsReceived).toEqual(updateData.trainingsReceived);
      expect(dbVisit?.resourcesReceived).toEqual(updateData.resourcesReceived);
      expect(dbVisit?.questions).toEqual(updateData.questions);
      expect(dbVisit?.photos).toEqual(updateData.photos);
      expect(dbVisit?.notes).toBe(updateData.notes);
      expect(dbVisit?.localId).toBe(updateData.localId);
    });

    it('should clear the trainings, resources, questions and photos arrays', async () => {
      const visit = await createTestFamilyVisit(family.id, {
        trainingsReceived: [{ id: 1, title: 'Nutrition basics' }],
        resourcesReceived: [{ id: 2, title: 'Water filter' }],
        questions: [{ questionId: 9, question: 'Clean water?', answer: 'Yes' }],
        photos: [31],
      });

      const updateData = {
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
        photos: [],
        notes: null,
      };

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, updateData, accessToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.trainingsReceived).toEqual([]);
      expect(result.resourcesReceived).toEqual([]);
      expect(result.questions).toEqual([]);
      expect(result.photos).toEqual([]);
      expect(result.notes).toBeNull();
    });

    it('should not reset untouched fields that have schema defaults', async () => {
      const visit = await createTestFamilyVisit(family.id, {
        trainingsReceived: [{ id: 1, title: 'Kept training' }],
        resourcesReceived: [{ id: 2, title: 'Kept resource' }],
        questions: [{ questionId: 9, question: 'Kept?', answer: 'Yes' }],
        photos: [77],
      });

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, { notes: 'Only notes' }, accessToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.notes).toBe('Only notes');
      expect(result.trainingsReceived).toEqual([{ id: 1, title: 'Kept training' }]);
      expect(result.resourcesReceived).toEqual([{ id: 2, title: 'Kept resource' }]);
      expect(result.questions).toEqual([{ questionId: 9, question: 'Kept?', answer: 'Yes' }]);
      expect(result.photos).toEqual([77]);
    });

    it('should return 404 when updating a soft-deleted visit', async () => {
      const visit = await createTestFamilyVisit(family.id);
      await testDb.familyVisit.update({
        where: { id: visit.id },
        data: { deletedAt: new Date() },
      });

      const response = await testClient.put(`/families/${family.id}/visits/${visit.id}`, { notes: 'Nope' }, accessToken);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /families/:familyId/visits/:id', () => {
    it('should soft delete visit for supervisor', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const response = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.message).toContain('deleted successfully');

      const dbVisit = await testDb.familyVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should soft delete visit for admin', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const response = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, adminToken);

      expect(response.status).toBe(200);

      const dbVisit = await testDb.familyVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should never hard delete the row', async () => {
      const visit = await createTestFamilyVisit(family.id, { notes: 'Preserved notes' });

      await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);

      const dbVisit = await testDb.familyVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit).not.toBeNull();
      expect(dbVisit?.notes).toBe('Preserved notes');
    });

    it('should return 403 for caseworker users', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const response = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, accessToken);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.message).toContain('Access denied');

      const dbVisit = await testDb.familyVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 401 without auth token', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const response = await testClient.delete(`/families/${family.id}/visits/${visit.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family visit', async () => {
      const response = await testClient.delete(`/families/${family.id}/visits/99999`, supervisorToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Family visit not found');
    });

    it('should return 404 on re-delete of an already deleted visit', async () => {
      const visit = await createTestFamilyVisit(family.id);

      const first = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);
      expect(first.status).toBe(200);

      const second = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);
      const error = await second.json();

      expect(second.status).toBe(404);
      expect(error.message).toBe('Family visit not found');
    });

    it('should return 404 for a visit from a different family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const visit = await createTestFamilyVisit(otherFamily.id);

      const response = await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);

      expect(response.status).toBe(404);

      const dbVisit = await testDb.familyVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.delete('/families/99999/visits/1', supervisorToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Family not found');
    });

    it('should exclude the deleted visit from the list', async () => {
      const deletedVisit = await createTestFamilyVisit(family.id, {
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
      });
      const keptVisit = await createTestFamilyVisit(family.id, {
        visitDate: new Date('2024-02-15T10:00:00.000Z'),
      });

      await testClient.delete(`/families/${family.id}/visits/${deletedVisit.id}`, supervisorToken);

      const listResponse = await testClient.get(`/families/${family.id}/visits`, accessToken);
      const visits = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(visits).toHaveLength(1);
      expect(visits[0].id).toBe(keptVisit.id);
    });

    it('should make the deleted visit unfetchable by id', async () => {
      const visit = await createTestFamilyVisit(family.id);

      await testClient.delete(`/families/${family.id}/visits/${visit.id}`, supervisorToken);

      const response = await testClient.get(`/families/${family.id}/visits/${visit.id}`, accessToken);

      expect(response.status).toBe(404);
    });
  });
});
