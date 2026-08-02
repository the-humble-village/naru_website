import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import parentVisitRoutes from '../src/routes/parent-visits';
import { testDb, createTestUser, createTestFamily, createTestParent } from './setup';
import { appConfig } from '../src/config';

// Create test app with parent visits routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

// Mount parent visits routes under /families/:familyId/parents/:pid/visits
app.route('/families/:familyId/parents/:pid/visits', parentVisitRoutes);

// Helper to create JWT tokens
const createTokens = (userId: number, role: string, lang: string = 'en') => {
  return jwt.sign({ userId, role, lang }, appConfig.JWT_SECRET, { expiresIn: '15m' });
};

// Helper to make requests with auth
const testClient = {
  get: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return app.request(new Request(`http://localhost${path}`, { method: 'GET', headers }));
  },

  post: async (path: string, body?: any, accessToken?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return app.request(new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }));
  },

  put: async (path: string, body?: any, accessToken?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return app.request(new Request(`http://localhost${path}`, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }));
  },

  delete: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return app.request(new Request(`http://localhost${path}`, { method: 'DELETE', headers }));
  },
};

// setup.ts has no parent-visit factory, so define one locally
const createTestParentVisit = async (familyId: number, parentId: number, overrides: any = {}) => {
  return testDb.parentVisit.create({
    data: {
      familyId,
      parentId,
      visitDate: new Date('2024-01-15T10:00:00.000Z'),
      weight: 62.5,
      trainingsReceived: [],
      resourcesReceived: [],
      questions: [],
      photos: [],
      notes: 'Test parent visit notes',
      ...overrides,
    },
  });
};

describe('Parent Visit Routes', () => {
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminUser: any;
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;
  let family: any;
  let parent: any;

  beforeEach(async () => {
    caseworkerUser = await createTestUser({
      login: 'caseworker',
      email: 'caseworker@example.com',
      role: 'CASEWORKER',
    });
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

    caseworkerToken = createTokens(caseworkerUser.id, caseworkerUser.role);
    supervisorToken = createTokens(supervisorUser.id, supervisorUser.role);
    adminToken = createTokens(adminUser.id, adminUser.role);

    family = await createTestFamily({ familyName: 'Parent Visits Test Family' });
    parent = await createTestParent(family.id, 'Test Parent for Visits', 'mother');
  });

  describe('GET /families/:familyId/parents/:pid/visits', () => {
    it('should return an empty page for a parent with no visits', async () => {
      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({ visits: [], total: 0, skip: 0, limit: 50 });
    });

    it('should return visits newest first', async () => {
      const older = await createTestParentVisit(family.id, parent.id, {
        visitDate: new Date('2024-01-15T10:00:00.000Z'),
      });
      const newer = await createTestParentVisit(family.id, parent.id, {
        visitDate: new Date('2024-05-15T10:00:00.000Z'),
      });

      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(2);
      expect(result.visits.map((v: any) => v.id)).toEqual([newer.id, older.id]);
    });

    it('should never expose deletedAt', async () => {
      await createTestParentVisit(family.id, parent.id);

      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits`, caseworkerToken);
      const result = await response.json();

      expect(result.visits[0]).not.toHaveProperty('deletedAt');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.get(`/families/99999/parents/${parent.id}/visits`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent parent', async () => {
      const response = await testClient.get(`/families/${family.id}/parents/99999/visits`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /families/:familyId/parents/:pid/visits', () => {
    it('should create a parent visit', async () => {
      const createData = {
        visitDate: '2024-04-01T12:00:00.000Z',
        weight: 64,
        trainingsReceived: [{ id: 1, title: 'Prenatal care' }],
        resourcesReceived: [{ id: 2, title: 'Vitamins' }],
        questions: [{ questionId: 3, question: 'Feeling well?', answer: 'Yes' }],
        photos: [10],
        notes: 'Created visit',
      };

      const response = await testClient.post(`/families/${family.id}/parents/${parent.id}/visits`, createData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result).toMatchObject(createData);
      expect(result.familyId).toBe(family.id);
      expect(result.parentId).toBe(parent.id);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post(`/families/${family.id}/parents/${parent.id}/visits`, {
        visitDate: '2024-04-01T12:00:00.000Z',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /families/:familyId/parents/:pid/visits/:id', () => {
    it('should return the visit', async () => {
      const visit = await createTestParentVisit(family.id, parent.id);

      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(visit.id);
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('should return 404 for a visit belonging to a different parent', async () => {
      const otherParent = await createTestParent(family.id, 'Other Parent', 'father');
      const otherVisit = await createTestParentVisit(family.id, otherParent.id);

      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits/${otherVisit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits/99999`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /families/:familyId/parents/:pid/visits/:id', () => {
    let visit: any;

    beforeEach(async () => {
      visit = await createTestParentVisit(family.id, parent.id);
    });

    it('should update every mutable field in a single request', async () => {
      const updateData = {
        visitDate: '2024-08-09T07:45:00.000Z',
        weight: 66.75,
        trainingsReceived: [{ id: 1, title: 'Breastfeeding' }],
        resourcesReceived: [
          { id: 2, title: 'Iron supplement' },
          { id: 3, title: 'Blanket' },
        ],
        questions: [{ questionId: 4, question: 'Sleeping well?', answer: 'No' }],
        photos: [51, 52],
        notes: 'Everything updated',
        localId: 'aa5d3955-375a-96c9-fc6b-99bbaa995555',
      };

      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject(updateData);

      // Verify every field actually persisted, not just echoed back
      const dbVisit = await testDb.parentVisit.findUnique({ where: { id: visit.id } });
      expect(dbVisit?.visitDate.toISOString()).toBe(updateData.visitDate);
      expect(dbVisit?.weight).toBe(updateData.weight);
      expect(dbVisit?.trainingsReceived).toEqual(updateData.trainingsReceived);
      expect(dbVisit?.resourcesReceived).toEqual(updateData.resourcesReceived);
      expect(dbVisit?.questions).toEqual(updateData.questions);
      expect(dbVisit?.photos).toEqual(updateData.photos);
      expect(dbVisit?.notes).toBe(updateData.notes);
      expect(dbVisit?.localId).toBe(updateData.localId);
    });

    it('should clear the trainings, resources, questions and photos arrays', async () => {
      await testDb.parentVisit.update({
        where: { id: visit.id },
        data: {
          trainingsReceived: [{ id: 1, title: 'Prenatal care' }],
          resourcesReceived: [{ id: 2, title: 'Vitamins' }],
          questions: [{ questionId: 3, question: 'Old?', answer: 'Old' }],
          photos: [9],
        },
      });

      const updateData = {
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
        photos: [],
        notes: null,
      };

      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.trainingsReceived).toEqual([]);
      expect(result.resourcesReceived).toEqual([]);
      expect(result.questions).toEqual([]);
      expect(result.photos).toEqual([]);
      expect(result.notes).toBeNull();
    });

    it('should not reset untouched fields that have schema defaults', async () => {
      await testDb.parentVisit.update({
        where: { id: visit.id },
        data: {
          weight: 70,
          trainingsReceived: [{ id: 1, title: 'Kept training' }],
          questions: [{ questionId: 3, question: 'Kept?', answer: 'Yes' }],
          photos: [88],
        },
      });

      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, { notes: 'Only notes' }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.notes).toBe('Only notes');
      expect(result.weight).toBe(70);
      expect(result.trainingsReceived).toEqual([{ id: 1, title: 'Kept training' }]);
      expect(result.questions).toEqual([{ questionId: 3, question: 'Kept?', answer: 'Yes' }]);
      expect(result.photos).toEqual([88]);
    });

    it('should reject a duplicate localId', async () => {
      const existingLocalId = 'bb6e4a66-486b-a7da-0d7c-aaccbbaa6666';
      await createTestParentVisit(family.id, parent.id, { localId: existingLocalId });

      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, { localId: existingLocalId }, caseworkerToken);
      const error = await response.json();

      expect(response.status).toBe(400);
      expect(error.message).toBe('Parent visit with this localId already exists');
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/99999`, { notes: 'Nope' }, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 when updating a soft-deleted visit', async () => {
      await testDb.parentVisit.update({
        where: { id: visit.id },
        data: { deletedAt: new Date() },
      });

      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, { notes: 'Nope' }, caseworkerToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Parent visit not found');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, { notes: 'Nope' });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await testClient.put(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, { visitDate: 'invalid-date' }, caseworkerToken);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /families/:familyId/parents/:pid/visits/:id', () => {
    let visit: any;

    beforeEach(async () => {
      visit = await createTestParentVisit(family.id, parent.id);
    });

    it('should soft delete visit for supervisor', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.message).toContain('deleted successfully');

      // `includeDeleted` opts out of the soft-delete extension, which now covers
      // ParentVisit — without it the deleted row is filtered out and reads null.
      const dbVisit = await testDb.parentVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should soft delete visit for admin', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, adminToken);

      expect(response.status).toBe(200);

      // `includeDeleted` opts out of the soft-delete extension, which now covers
      // ParentVisit — without it the deleted row is filtered out and reads null.
      const dbVisit = await testDb.parentVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit?.deletedAt).toBeTruthy();
    });

    it('should never hard delete the row', async () => {
      await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);

      const dbVisit = await testDb.parentVisit.findUnique({
        where: { id: visit.id },
        includeDeleted: true,
      } as any);
      expect(dbVisit).not.toBeNull();
      expect(dbVisit?.weight).toBe(visit.weight);
      expect(dbVisit?.notes).toBe(visit.notes);
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, caseworkerToken);
      const error = await response.json();

      expect(response.status).toBe(403);
      expect(error.message).toContain('Access denied');

      const dbVisit = await testDb.parentVisit.findUnique({ where: { id: visit.id } });
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/99999`, supervisorToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Parent visit not found');
    });

    it('should return 404 on re-delete of an already deleted visit', async () => {
      const first = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);
      expect(first.status).toBe(200);

      const second = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);
      const error = await second.json();

      expect(second.status).toBe(404);
      expect(error.message).toBe('Parent visit not found');
    });

    it('should return 404 for a visit belonging to a different parent', async () => {
      const otherParent = await createTestParent(family.id, 'Other Parent', 'father');
      const otherVisit = await createTestParentVisit(family.id, otherParent.id);

      const response = await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${otherVisit.id}`, supervisorToken);

      expect(response.status).toBe(404);

      const dbVisit = await testDb.parentVisit.findUnique({ where: { id: otherVisit.id } });
      expect(dbVisit?.deletedAt).toBeNull();
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.delete(`/families/99999/parents/${parent.id}/visits/${visit.id}`, supervisorToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Family not found');
    });

    it('should return 404 for non-existent parent', async () => {
      const response = await testClient.delete(`/families/${family.id}/parents/99999/visits/${visit.id}`, supervisorToken);
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.message).toBe('Parent not found');
    });

    // ParentVisit is absent from the soft-delete Prisma extension, so this asserts the
    // service's own deletedAt filters are doing the work.
    it('should exclude the deleted visit from the list and its total', async () => {
      const keptVisit = await createTestParentVisit(family.id, parent.id, {
        visitDate: new Date('2024-03-15T10:00:00.000Z'),
      });

      await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);

      const listResponse = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits`, caseworkerToken);
      const result = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.visits).toHaveLength(1);
      expect(result.visits[0].id).toBe(keptVisit.id);
    });

    it('should make the deleted visit unfetchable by id', async () => {
      await testClient.delete(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, supervisorToken);

      const response = await testClient.get(`/families/${family.id}/parents/${parent.id}/visits/${visit.id}`, caseworkerToken);

      expect(response.status).toBe(404);
    });
  });
});
