import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import childrenRoutes from '../src/routes/children';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestChild,
  createTestMother,
  createTestProgram,
  createTestEnrollment,
} from './setup';
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

app.route('/children', childrenRoutes);

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
    caseworkerUser = await createTestUser({ login: 'caseworker', role: 'CASEWORKER' });
    supervisorUser = await createTestUser({ login: 'supervisor', role: 'SUPERVISOR' });
    adminUser = await createTestUser({ login: 'admin', role: 'ADMIN' });

    caseworkerToken = createTokens(caseworkerUser.id, caseworkerUser.role);
    supervisorToken = createTokens(supervisorUser.id, supervisorUser.role);
    adminToken = createTokens(adminUser.id, adminUser.role);

    testFamily = await createTestFamily({ familyName: 'Children Test Family' });
  });

  describe('GET /children', () => {
    it('should return an empty page when there are no children', async () => {
      const response = await testClient.get('/children', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return children with the V2 shape', async () => {
      await createTestChild({ name: 'Child One', sex: 'FEMALE', familyId: testFamily.id });
      await createTestChild({ name: 'Child Two', sex: 'MALE', familyId: testFamily.id });

      const response = await testClient.get('/children', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);

      const child = result.items[0];
      expect(child.id).toBeDefined();
      expect(child.name).toBeDefined();
      expect(child.birthDate).toBeDefined();
      expect(child.sex).toBeDefined();
      expect(child.motherId).toBeDefined();
      expect(child.communityId).toBeDefined();
      expect(child.familyId).toBe(testFamily.id);
      expect(child.createdAt).toBeDefined();
      expect(child.deletedAt).toBeUndefined(); // Should not be exposed

      // Measurements moved to nutrition visit details.
      expect(child.weight).toBeUndefined();
      expect(child.nutritionalState).toBeUndefined();
    });

    it('should filter by familyId', async () => {
      const otherFamily = await createTestFamily({ familyName: 'Other Family' });
      await createTestChild({ name: 'Ours', familyId: testFamily.id });
      await createTestChild({ name: 'Theirs', familyId: otherFamily.id });

      const response = await testClient.get(`/children?familyId=${testFamily.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Ours');
    });

    it('should filter by motherId', async () => {
      const mother = await createTestMother({ name: 'Linked Mother' });
      await createTestChild({ name: 'Hers', motherId: mother.id });
      await createTestChild({ name: 'Unlinked' });

      const response = await testClient.get(`/children?motherId=${mother.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Hers');
    });

    it('should filter to children with no active enrollment', async () => {
      const enrolled = await createTestChild({ name: 'Enrolled Child' });
      await createTestChild({ name: 'Unenrolled Child' });

      const program = await createTestProgram();
      await createTestEnrollment(program.id, { childId: enrolled.id });

      const response = await testClient.get('/children?unenrolled=true', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Unenrolled Child');
    });

    it('should treat an exited enrollment as unenrolled', async () => {
      const child = await createTestChild({ name: 'Graduated Child' });
      const program = await createTestProgram();
      await createTestEnrollment(program.id, { childId: child.id }, {
        exitedAt: new Date('2026-03-01'),
        exitReason: 'GRADUATED',
      });

      const response = await testClient.get('/children?unenrolled=true', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Graduated Child');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/children');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /children', () => {
    it('should create child successfully', async () => {
      const childData = {
        name: 'New Test Child',
        birthDate: '2022-06-15T00:00:00.000Z',
        sex: 'FEMALE' as const,
        familyId: testFamily.id,
        notes: 'Healthy child',
      };

      const response = await testClient.post('/children', childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.name).toBe(childData.name);
      expect(result.birthDate).toBe(childData.birthDate);
      expect(result.sex).toBe(childData.sex);
      expect(result.notes).toBe(childData.notes);
      expect(result.familyId).toBe(testFamily.id);

      const dbChild = await testDb.child.findUnique({ where: { id: result.id } });
      expect(dbChild?.name).toBe(childData.name);
    });

    it('should admit a child with no family and no mother', async () => {
      const childData = {
        name: 'Unaccompanied Infant',
        birthDate: '2026-01-01T00:00:00.000Z',
        sex: 'MALE' as const,
      };

      const response = await testClient.post('/children', childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.familyId).toBeNull();
      expect(result.motherId).toBeNull();
    });

    it('should link a child to a mother', async () => {
      const mother = await createTestMother({ name: 'Linked Mother' });

      const response = await testClient.post('/children', {
        name: 'Linked Child',
        birthDate: '2025-02-01T00:00:00.000Z',
        sex: 'FEMALE' as const,
        motherId: mother.id,
      }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.motherId).toBe(mother.id);
    });

    it('should handle localId for offline sync', async () => {
      const childData = {
        name: 'Offline Child',
        birthDate: '2022-12-25T00:00:00.000Z',
        sex: 'FEMALE' as const,
        localId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const response = await testClient.post('/children', childData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.localId).toBe(childData.localId);
    });

    it('should reject duplicate localId', async () => {
      const localId = '550e8400-e29b-41d4-a716-446655440001';
      await createTestChild({ name: 'First Child', localId });

      const response = await testClient.post('/children', {
        name: 'Duplicate LocalId Child',
        birthDate: '2022-05-01T00:00:00.000Z',
        sex: 'MALE' as const,
        localId,
      }, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should return 404 for non-existent family', async () => {
      const response = await testClient.post('/children', {
        name: 'Orphan Child',
        birthDate: '2022-01-01T00:00:00.000Z',
        sex: 'FEMALE' as const,
        familyId: 99999,
      }, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent mother', async () => {
      const response = await testClient.post('/children', {
        name: 'Orphan Child',
        birthDate: '2022-01-01T00:00:00.000Z',
        sex: 'FEMALE' as const,
        motherId: 99999,
      }, caseworkerToken);

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/children', {
        name: 'Unauthorized Child',
        birthDate: '2022-01-01T00:00:00.000Z',
        sex: 'MALE' as const,
      });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await testClient.post('/children', {
        name: 'Invalid Child',
        // Missing required birthDate and sex
      }, caseworkerToken);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild({
        name: 'Detail Test Child',
        sex: 'MALE',
        birthDate: new Date('2020-01-15'),
        familyId: testFamily.id,
      });
    });

    it('should return the child', async () => {
      const response = await testClient.get(`/children/${testChild.id}`, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testChild.id);
      expect(result.name).toBe(testChild.name);
      expect(result.sex).toBe(testChild.sex);
      expect(result.familyId).toBe(testFamily.id);
      expect(result.deletedAt).toBeUndefined(); // Should not be exposed
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get(`/children/${testChild.id}`);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.get('/children/99999', caseworkerToken);

      expect(response.status).toBe(404);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Child not found');
      }
    });
  });

  describe('PUT /children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild({
        name: 'Update Test Child',
        sex: 'FEMALE',
        familyId: testFamily.id,
      });
    });

    it('should update child successfully', async () => {
      const updateData = {
        name: 'Updated Child Name',
        notes: 'Updated notes',
      };

      const response = await testClient.put(`/children/${testChild.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(testChild.id);
      expect(result.name).toBe(updateData.name);
      expect(result.notes).toBe(updateData.notes);

      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.name).toBe(updateData.name);
    });

    it('should handle partial updates', async () => {
      const response = await testClient.put(`/children/${testChild.id}`, {
        notes: 'Only the notes changed',
      }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.name).toBe(testChild.name); // Unchanged
      expect(result.notes).toBe('Only the notes changed');
    });

    it('should reparent a child to a family', async () => {
      const orphan = await createTestChild({ name: 'Orphan Child' });

      const response = await testClient.put(`/children/${orphan.id}`, {
        familyId: testFamily.id,
      }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.familyId).toBe(testFamily.id);
    });

    it('should update localId if provided', async () => {
      const updateData = {
        localId: '661f9511-f30c-52e5-b827-557766551111',
      };

      const response = await testClient.put(`/children/${testChild.id}`, updateData, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.localId).toBe(updateData.localId);
    });

    it('should reject duplicate localId on update', async () => {
      const existingLocalId = '772a0622-042d-63f6-c938-668877662222';
      await createTestChild({ name: 'Other Child', localId: existingLocalId });

      const response = await testClient.put(`/children/${testChild.id}`, {
        localId: existingLocalId,
      }, caseworkerToken);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('localId already exists');
      }
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.put('/children/99999', { name: 'Nope' }, caseworkerToken);
      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.put(`/children/${testChild.id}`, { name: 'Unauthorized' });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /children/:id', () => {
    let testChild: any;

    beforeEach(async () => {
      testChild = await createTestChild({ name: 'Delete Test Child', familyId: testFamily.id });
    });

    it('should soft delete child for supervisor', async () => {
      const response = await testClient.delete(`/children/${testChild.id}`, supervisorToken);

      expect(response.status).toBe(200);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('deleted successfully');
      }

      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeTruthy();
    });

    it('should soft delete child for admin', async () => {
      const response = await testClient.delete(`/children/${testChild.id}`, adminToken);

      expect(response.status).toBe(200);

      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeTruthy();
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/children/${testChild.id}`, caseworkerToken);

      expect(response.status).toBe(403);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Access denied');
      }

      const dbChild = await testDb.child.findUnique({
        where: { id: testChild.id },
        includeDeleted: true,
      } as any);
      expect(dbChild?.deletedAt).toBeNull();
    });

    it('should return 404 for non-existent child', async () => {
      const response = await testClient.delete('/children/99999', supervisorToken);
      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.delete(`/children/${testChild.id}`);
      expect(response.status).toBe(401);
    });
  });
});
