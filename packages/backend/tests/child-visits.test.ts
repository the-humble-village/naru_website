import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import childVisitRoutes from '../src/routes/child-visits';
import { testDb, createTestUser, createTestFamily, createTestChild, createTestChildVisit } from './setup';
import { appConfig } from '../src/config';

// Create test app with child visits routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

// Mount child visits routes under /families/:fid/children/:cid/visits
app.route('/families/:fid/children/:cid/visits', childVisitRoutes);

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

describe('Child Visits Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;
  let testFamily: any;
  let testChild: any;

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

    // Create test family and child
    testFamily = await createTestFamily({ familyName: 'Child Visits Test Family' });
    testChild = await createTestChild(testFamily.id, 'Test Child for Visits', {
      sex: 'FEMALE',
      birthDate: new Date('2020-06-15'),
    });
  });

  describe('GET /families/:fid/children/:cid/visits', () => {
    it('should return an empty page for child with no visits', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({ visits: [], total: 0, skip: 0, limit: 50 });
    });

    it('should return visits for child with visits', async () => {
      // Create test visits
      await createTestChildVisit(testFamily.id, testChild.id, {
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
        weight: 16,
      });
      await createTestChildVisit(testFamily.id, testChild.id, {
        visitDate: new Date('2024-02-15T10:00:00.000Z'),
        weight: 16.5,
      });

      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.visits).toHaveLength(2);
      expect(result.total).toBe(2);

      // Visits should be ordered by visitDate descending (most recent first)
      expect(new Date(result.visits[0].visitDate).getTime()).toBeGreaterThan(new Date(result.visits[1].visitDate).getTime());

      // Check visit structure
      const visit = result.visits[0];
      expect(visit.id).toBeDefined();
      expect(visit.familyId).toBe(testFamily.id);
      expect(visit.childId).toBe(testChild.id);
      expect(visit.visitDate).toBeDefined();
      expect(visit.weight).toBeDefined();
      expect(visit.armCircumference).toBeDefined();
      expect(visit.height).toBeDefined();
      expect(typeof visit.incap).toBe('boolean');
      expect(typeof visit.leche).toBe('boolean');
      expect(visit.createdAt).toBeDefined();
      expect(visit.updatedAt).toBeDefined();
      expect(visit.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should support pagination with skip and limit', async () => {
      // Create multiple visits
      for (let i = 0; i < 5; i++) {
        await createTestChildVisit(testFamily.id, testChild.id, {
          visitDate: new Date(`2024-0${i + 1}-15T10:00:00.000Z`),
        });
      }

      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits?skip=2&limit=2`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.visits).toHaveLength(2);
      // total counts every matching visit, not just the returned page
      expect(result).toMatchObject({ total: 5, skip: 2, limit: 2 });
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get(`/families/99999/children/${testChild.id}/visits`, caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Family not found');
      }
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/99999/visits`, caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Child not found');
      }
    });

    it('should return 404 for child in wrong family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const otherChild = await createTestChild(otherFamily.id, 'Other Child');

      const response = await testClient.get(`/families/${testFamily.id}/children/${otherChild.id}/visits`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /families/:fid/children/:cid/visits', () => {
    it('should create child visit successfully', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17, // kg
        armCircumference: 145, // 145mm
        height: 1050, // 1050mm (105cm)
        incap: true,
        leche: true,
        bagsGiven: 'Nutritional supplement bags',
        recvAnyMedicine: 'Vitamins',
        leftFromProg: null,
        passedAway: null,
        questions: [
          {
            questionId: 1,
            question: 'How is the child eating?',
            answer: 'Very well',
          },
        ],
        notes: 'Child is developing well',
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.familyId).toBe(testFamily.id);
      expect(result.childId).toBe(testChild.id);
      expect(result.visitDate).toBe(visitData.visitDate);
      expect(result.weight).toBe(visitData.weight);
      expect(result.armCircumference).toBe(visitData.armCircumference);
      expect(result.height).toBe(visitData.height);
      expect(result.incap).toBe(visitData.incap);
      expect(result.leche).toBe(visitData.leche);
      expect(result.bagsGiven).toBe(visitData.bagsGiven);
      expect(result.recvAnyMedicine).toBe(visitData.recvAnyMedicine);
      expect(result.questions).toEqual(visitData.questions);
      expect(result.notes).toBe(visitData.notes);

      // Verify in database
      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: result.id },
      });
      expect(dbVisit).toBeTruthy();
      expect(dbVisit?.weight).toBe(visitData.weight);
    });

    it('should create child visit with minimal data', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.visitDate).toBe(visitData.visitDate);
      expect(result.weight).toBe(0); // Default value
      expect(result.armCircumference).toBe(0); // Default value
      expect(result.height).toBe(0); // Default value
      expect(result.incap).toBe(false); // Default value
      expect(result.leche).toBe(false); // Default value
      expect(result.questions).toEqual([]); // Default value
    });

    it('should handle localId for offline sync', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
        localId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.localId).toBe(visitData.localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440001';

      // Create first visit
      await createTestChildVisit(testFamily.id, testChild.id, { localId });

      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
        localId,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should return 401 without auth token', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
      };

      const response = await testClient.post(`/families/99999/children/${testChild.id}/visits`, visitData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent child', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/99999/visits`, visitData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should validate request body', async () => {
      const invalidVisitData = {
        // Missing required visitDate
        weight: 17,
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, invalidVisitData, caseworkerToken);

      expect(response.status).toBe(400); // Validation error
    });

    it('should validate questions array structure', async () => {
      const visitData = {
        visitDate: '2024-03-15T10:00:00.000Z',
        weight: 17,
        questions: [
          {
            // Missing questionId
            question: 'How is the child eating?',
            answer: 'Very well',
          },
        ],
      };

      const response = await testClient.post(`/families/${testFamily.id}/children/${testChild.id}/visits`, visitData, caseworkerToken);

      expect(response.status).toBe(400); // Validation error
    });
  });

  describe('GET /families/:fid/children/:cid/visits/:id', () => {
    let testVisit: any;

    beforeEach(async () => {
      testVisit = await createTestChildVisit(testFamily.id, testChild.id, {
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
        weight: 16,
        armCircumference: 140,
        height: 1000,
        notes: 'Test visit for detail view',
      });
    });

    it('should return visit detail successfully', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testVisit.id);
      expect(result.familyId).toBe(testFamily.id);
      expect(result.childId).toBe(testChild.id);
      expect(result.weight).toBe(testVisit.weight);
      expect(result.armCircumference).toBe(testVisit.armCircumference);
      expect(result.height).toBe(testVisit.height);
      expect(result.notes).toBe(testVisit.notes);
      expect(result.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/99999`, caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Child visit not found');
      }
    });

    it('should return 404 for visit in wrong family', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      const otherChild = await createTestChild(otherFamily.id, 'Other Child');
      const otherVisit = await createTestChildVisit(otherFamily.id, otherChild.id);

      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/${otherVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for visit with wrong child', async () => {
      const otherChild = await createTestChild(testFamily.id, 'Other Child in Same Family');
      const otherVisit = await createTestChildVisit(testFamily.id, otherChild.id);

      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/${otherVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get(`/families/99999/children/${testChild.id}/visits/${testVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.get(`/families/${testFamily.id}/children/99999/visits/${testVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /families/:fid/children/:cid/visits/:id', () => {
    let testVisit: any;

    beforeEach(async () => {
      testVisit = await createTestChildVisit(testFamily.id, testChild.id, {
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
        weight: 16,
        armCircumference: 140,
        height: 1000,
        incap: false,
        leche: false,
        notes: 'Original notes',
      });
    });

    it('should update visit successfully', async () => {
      const updateData = {
        weight: 17.5,
        armCircumference: 150,
        height: 1100,
        incap: true,
        leche: true,
        bagsGiven: 'Updated bags given',
        notes: 'Updated notes',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testVisit.id);
      expect(result.weight).toBe(updateData.weight);
      expect(result.armCircumference).toBe(updateData.armCircumference);
      expect(result.height).toBe(updateData.height);
      expect(result.incap).toBe(updateData.incap);
      expect(result.leche).toBe(updateData.leche);
      expect(result.bagsGiven).toBe(updateData.bagsGiven);
      expect(result.notes).toBe(updateData.notes);

      // Verify in database
      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: testVisit.id },
      });
      expect(dbVisit?.weight).toBe(updateData.weight);
      expect(dbVisit?.notes).toBe(updateData.notes);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        weight: 18, // Only update weight
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.weight).toBe(updateData.weight); // Updated
      expect(result.armCircumference).toBe(testVisit.armCircumference); // Unchanged
      expect(result.notes).toBe(testVisit.notes); // Unchanged
    });

    it('should update localId if provided', async () => {
      const updateData = {
        localId: '661f9511-f30c-52e5-b827-557766551111',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.localId).toBe(updateData.localId);
    });

    it('should reject duplicate localId on update', async () => {
      const existingLocalId = '772a0622-042d-63f6-c938-668877662222';

      // Create another visit with a localId
      await createTestChildVisit(testFamily.id, testChild.id, { localId: existingLocalId });

      const updateData = {
        localId: existingLocalId,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should update questions array', async () => {
      const updateData = {
        questions: [
          {
            questionId: 1,
            question: 'Updated question?',
            answer: 'Updated answer',
          },
          {
            questionId: 2,
            question: 'New question?',
            answer: 'New answer',
          },
        ],
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.questions).toEqual(updateData.questions);
    });

    it('should return 404 for non-existent visit', async () => {
      const updateData = {
        weight: 18,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/99999`, updateData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const updateData = {
        weight: 18,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const updateData = {
        weight: 18,
      };

      const response = await testClient.put(`/families/99999/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent child', async () => {
      const updateData = {
        weight: 18,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/99999/visits/${testVisit.id}`, updateData, caseworkerToken);

      expect(response.status).toBe(404);
    });

    // Regression: these columns were reachable through the schema but had no coverage,
    // so nothing proved the service actually wrote them.
    it('should update every mutable field in a single request', async () => {
      const updateData = {
        visitDate: '2024-06-01T08:30:00.000Z',
        weight: 19.25,
        armCircumference: 155,
        height: 1150,
        incap: true,
        leche: true,
        bagsGiven: '3 bags',
        recvAnyMedicine: 'Amoxicillin',
        leftFromProg: 'Moved away',
        passedAway: 'No',
        questions: [{ questionId: 7, question: 'Eating well?', answer: 'Yes' }],
        photos: [11, 22],
        notes: 'Everything updated',
        localId: '883b1733-153e-74a7-da49-779988773333',
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject(updateData);

      // Verify every field actually persisted, not just echoed back
      const dbVisit = await testDb.childVisit.findUnique({ where: { id: testVisit.id } });
      expect(dbVisit?.visitDate.toISOString()).toBe(updateData.visitDate);
      expect(dbVisit?.weight).toBe(updateData.weight);
      expect(dbVisit?.armCircumference).toBe(updateData.armCircumference);
      expect(dbVisit?.height).toBe(updateData.height);
      expect(dbVisit?.incap).toBe(true);
      expect(dbVisit?.leche).toBe(true);
      expect(dbVisit?.bagsGiven).toBe(updateData.bagsGiven);
      expect(dbVisit?.recvAnyMedicine).toBe(updateData.recvAnyMedicine);
      expect(dbVisit?.leftFromProg).toBe(updateData.leftFromProg);
      expect(dbVisit?.passedAway).toBe(updateData.passedAway);
      expect(dbVisit?.questions).toEqual(updateData.questions);
      expect(dbVisit?.photos).toEqual(updateData.photos);
      expect(dbVisit?.notes).toBe(updateData.notes);
      expect(dbVisit?.localId).toBe(updateData.localId);
    });

    it('should clear nullable text fields when explicitly set to null', async () => {
      await testDb.childVisit.update({
        where: { id: testVisit.id },
        data: {
          bagsGiven: '2 bags',
          recvAnyMedicine: 'Some medicine',
          leftFromProg: 'Yes',
          passedAway: 'No',
        },
      });

      const updateData = {
        bagsGiven: null,
        recvAnyMedicine: null,
        leftFromProg: null,
        passedAway: null,
        notes: null,
      };

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.bagsGiven).toBeNull();
      expect(result.recvAnyMedicine).toBeNull();
      expect(result.leftFromProg).toBeNull();
      expect(result.passedAway).toBeNull();
      expect(result.notes).toBeNull();
    });

    it('should replace the photos array and allow clearing it', async () => {
      const setResponse = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, { photos: [5, 6, 7] }, caseworkerToken);
      expect((await setResponse.json()).photos).toEqual([5, 6, 7]);

      const clearResponse = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, { photos: [] }, caseworkerToken);
      expect((await clearResponse.json()).photos).toEqual([]);
    });

    it('should clear the questions array when passed an empty array', async () => {
      await testDb.childVisit.update({
        where: { id: testVisit.id },
        data: { questions: [{ questionId: 1, question: 'Old?', answer: 'Old' }] },
      });

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, { questions: [] }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.questions).toEqual([]);
    });

    it('should not reset untouched fields that have schema defaults', async () => {
      await testDb.childVisit.update({
        where: { id: testVisit.id },
        data: {
          incap: true,
          leche: true,
          questions: [{ questionId: 1, question: 'Kept?', answer: 'Yes' }],
          photos: [42],
        },
      });

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, { notes: 'Only notes' }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.notes).toBe('Only notes');
      expect(result.incap).toBe(true);
      expect(result.leche).toBe(true);
      expect(result.questions).toEqual([{ questionId: 1, question: 'Kept?', answer: 'Yes' }]);
      expect(result.photos).toEqual([42]);
    });

    it('should return 404 when updating a soft-deleted visit', async () => {
      await testDb.childVisit.update({
        where: { id: testVisit.id },
        data: { deletedAt: new Date() },
      });

      const response = await testClient.put(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, { weight: 20 }, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /families/:fid/children/:cid/visits/:id', () => {
    let testVisit: any;

    beforeEach(async () => {
      testVisit = await createTestChildVisit(testFamily.id, testChild.id);
    });

    it('should soft delete visit for supervisor', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.message).toContain('deleted successfully');

      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: testVisit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should soft delete visit for admin', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, adminToken);

      expect(response.status).toBe(200);

      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: testVisit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should never hard delete the row', async () => {
      await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);

      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: testVisit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit).not.toBeNull();
      expect(dbVisit?.weight).toBe(testVisit.weight);
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.message).toContain('Access denied');

      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: testVisit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/99999`, supervisorToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 on re-delete of an already deleted visit', async () => {
      const first = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);
      expect(first.status).toBe(200);

      const second = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);
      const result = await second.json();

      expect(second.status).toBe(404);
      expect(result.message).toBe('Child visit not found');
    });

    it('should return 404 for a visit belonging to a different child', async () => {
      const otherChild = await createTestChild(testFamily.id, 'Other Child');
      const otherVisit = await createTestChildVisit(testFamily.id, otherChild.id);

      const response = await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${otherVisit.id}`, supervisorToken);

      expect(response.status).toBe(404);

      const dbVisit = await testDb.childVisit.findUnique({
        where: { id: otherVisit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.delete(`/families/99999/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.delete(`/families/${testFamily.id}/children/99999/visits/${testVisit.id}`, supervisorToken);

      expect(response.status).toBe(404);
    });

    it('should exclude the deleted visit from the list', async () => {
      const keptVisit = await createTestChildVisit(testFamily.id, testChild.id, {
        visitDate: new Date('2024-03-15T10:00:00.000Z'),
      });

      await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);

      const listResponse = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits`, caseworkerToken);
      const result = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(result.visits).toHaveLength(1);
      expect(result.visits[0].id).toBe(keptVisit.id);
      // total must skip the tombstone too, or the client paginates over phantom rows
      expect(result.total).toBe(1);
    });

    it('should make the deleted visit unfetchable by id', async () => {
      await testClient.delete(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, supervisorToken);

      const response = await testClient.get(`/families/${testFamily.id}/children/${testChild.id}/visits/${testVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });
});
