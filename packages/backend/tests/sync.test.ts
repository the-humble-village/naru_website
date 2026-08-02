import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import syncRoutes from '../src/routes/sync';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestCommunity,
  createTestChild,
  createTestParent,
  createTestTraining
} from './setup';
import { appConfig } from '../src/config';

// Create test app with sync routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/sync', syncRoutes);

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
  post: async (path: string, data: any, accessToken?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return app.request(request);
  },
};

describe('Sync Routes', () => {
  let testUser: any;
  let accessToken: string;
  let community: any;
  let training: any;

  beforeEach(async () => {
    // Create test user
    testUser = await createTestUser({
      login: 'testuser',
      email: 'test@example.com',
      role: 'CASEWORKER',
    });
    accessToken = createTokens(testUser.id, testUser.role);

    // Create test data
    community = await createTestCommunity({ title: 'Test Community' });
    training = await createTestTraining('Test Training');
  });

  describe('POST /sync', () => {
    it('should process valid batch of creates successfully', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'family',
            operation: 'create',
            localId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              familyName: 'Garcia Family',
              inCrisis: false,
              communityId: community.id,
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
          {
            entity: 'child',
            operation: 'create',
            localId: '661f9511-f30c-52e5-b827-557766551111',
            parentLocalId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              name: 'Maria Garcia',
              birthDate: '2020-01-15T00:00:00Z',
              sex: 'FEMALE',
            },
            changedAt: '2024-03-01T11:45:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('created');
      expect(result.results[0].serverId).toBeDefined();
      expect(result.results[1].status).toBe('created');
      expect(result.results[1].serverId).toBeDefined();

      // Verify records were created in database
      const family = await testDb.family.findUnique({
        where: { localId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(family).toBeTruthy();
      expect(family?.familyName).toBe('Garcia Family');

      const child = await testDb.child.findUnique({
        where: { localId: '661f9511-f30c-52e5-b827-557766551111' },
      });
      expect(child).toBeTruthy();
      expect(child?.name).toBe('Maria Garcia');
      expect(child?.familyId).toBe(family?.id);
    });

    it('should detect duplicate localId and return already_exists', async () => {
      // Create a family first
      const existingFamily = await createTestFamily({
        localId: '550e8400-e29b-41d4-a716-446655440000',
        familyName: 'Existing Family',
      });

      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'family',
            operation: 'create',
            localId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              familyName: 'Duplicate Family',
              inCrisis: false,
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('already_exists');
      expect(result.results[0].serverId).toBe(existingFamily.id);

      // Verify no new family was created
      const families = await testDb.family.findMany({
        where: { localId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(families).toHaveLength(1);
      expect(families[0].familyName).toBe('Existing Family'); // Original name preserved
    });

    it('should reject invalid operation type', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'family',
            operation: 'update', // Invalid operation
            localId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              familyName: 'Updated Family',
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(400);

      // Zod validation should reject invalid operation type
      const result = await response.json();
      expect(result).toBeDefined();
    });

    it('should rollback entire transaction on partial failure', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'family',
            operation: 'create',
            localId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              familyName: 'Valid Family',
              inCrisis: false,
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
          {
            entity: 'child',
            operation: 'create',
            localId: '661f9511-f30c-52e5-b827-557766551111',
            parentLocalId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              name: 'Invalid Child',
              // Missing required fields like birthDate, sex (familyId will be resolved from parentLocalId)
            },
            changedAt: '2024-03-01T11:45:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.message).toContain('Sync operation failed');

      // Verify no records were created (transaction rolled back)
      const family = await testDb.family.findUnique({
        where: { localId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(family).toBe(null);
    });

    it('should resolve dependency order correctly', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          // Send child first (should be processed after family due to dependency order)
          {
            entity: 'child',
            operation: 'create',
            localId: '661f9511-f30c-52e5-b827-557766551111',
            parentLocalId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              name: 'Maria Garcia',
              birthDate: '2020-01-15T00:00:00Z',
              sex: 'FEMALE',
            },
            changedAt: '2024-03-01T11:45:00Z',
          },
          // Send family second (should be processed first due to dependency order)
          {
            entity: 'family',
            operation: 'create',
            localId: '550e8400-e29b-41d4-a716-446655440000',
            data: {
              familyName: 'Garcia Family',
              inCrisis: false,
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('created');
      expect(result.results[1].status).toBe('created');

      // Verify both records were created and linked properly
      const family = await testDb.family.findUnique({
        where: { localId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const child = await testDb.child.findUnique({
        where: { localId: '661f9511-f30c-52e5-b827-557766551111' },
      });

      expect(family).toBeTruthy();
      expect(child).toBeTruthy();
      expect(child?.familyId).toBe(family?.id);
    });

    it('should include lookup tables in server changes', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.serverChanges.lookups).toBeDefined();
      expect(result.serverChanges.lookups.communities).toBeDefined();
      expect(result.serverChanges.lookups.sites).toBeDefined();
      expect(result.serverChanges.lookups.resources).toBeDefined();
      expect(result.serverChanges.lookups.training).toBeDefined();
      expect(result.serverChanges.lookups.childVisitQuestions).toBeDefined();
      expect(result.serverChanges.lookups.parentVisitQuestions).toBeDefined();
      expect(result.serverChanges.lookups.familyVisitQuestions).toBeDefined();

      // Verify our test community and training are included
      expect(result.serverChanges.lookups.communities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: community.id,
            title: 'Test Community',
          }),
        ])
      );
      expect(result.serverChanges.lookups.training).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: training.id,
            title: 'Test Training',
          }),
        ])
      );
    });

    it('should return updated records since lastSyncedAt', async () => {
      // Create some existing data
      const existingFamily = await createTestFamily({
        familyName: 'Existing Family',
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      });

      const newFamily = await createTestFamily({
        familyName: 'New Family',
        updatedAt: new Date('2024-03-01T10:00:00Z'),
      });

      const syncRequest = {
        lastSyncedAt: '2024-02-01T00:00:00Z',
        changes: [],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();

      // Should only include the new family (updated after lastSyncedAt)
      expect(result.serverChanges.families).toHaveLength(1);
      expect(result.serverChanges.families[0].id).toBe(newFamily.id);
      expect(result.serverChanges.families[0].familyName).toBe('New Family');
    });

    describe('tombstones for soft-deleted records', () => {
      // A soft-deleted row drops out of every other serverChanges array (the
      // soft-delete extension filters it), so without a tombstone an offline
      // client would keep the record forever.

      it('should report a family soft-deleted since lastSyncedAt', async () => {
        const family = await createTestFamily({ familyName: 'Deleted Family' });
        await testDb.family.update({
          where: { id: family.id },
          data: { deletedAt: new Date('2024-03-01T10:00:00Z') },
        });

        const response = await testClient.post(
          '/sync',
          { lastSyncedAt: '2024-02-01T00:00:00Z', changes: [] },
          accessToken
        );
        expect(response.status).toBe(200);

        const result = await response.json();
        const tombstone = result.serverChanges.deleted.find(
          (t: any) => t.entity === 'family' && t.id === family.id
        );
        expect(tombstone).toBeDefined();
        expect(tombstone.localId).toBe(family.localId ?? null);
        expect(new Date(tombstone.deletedAt).toISOString())
          .toBe(new Date('2024-03-01T10:00:00Z').toISOString());

        // ...and it is absent from the live array, which is the whole problem
        // the tombstone exists to solve.
        expect(result.serverChanges.families.map((f: any) => f.id)).not.toContain(family.id);
      });

      it('should omit records deleted before lastSyncedAt', async () => {
        const family = await createTestFamily({ familyName: 'Long Gone' });
        await testDb.family.update({
          where: { id: family.id },
          data: { deletedAt: new Date('2024-01-01T10:00:00Z') },
        });

        const response = await testClient.post(
          '/sync',
          { lastSyncedAt: '2024-02-01T00:00:00Z', changes: [] },
          accessToken
        );

        const result = await response.json();
        expect(result.serverChanges.deleted.some((t: any) => t.id === family.id)).toBe(false);
      });

      it('should return no tombstones on a first sync', async () => {
        const family = await createTestFamily({ familyName: 'Deleted Family' });
        await testDb.family.update({
          where: { id: family.id },
          data: { deletedAt: new Date('2024-03-01T10:00:00Z') },
        });

        const response = await testClient.post(
          '/sync',
          { lastSyncedAt: null, changes: [] },
          accessToken
        );

        // A client with an empty local database has nothing to delete, and the
        // unbounded history of every deletion would be pure noise.
        const result = await response.json();
        expect(result.serverChanges.deleted).toEqual([]);
      });

      it('should report soft-deleted lookup rows, which clients cache', async () => {
        const doomed = await createTestCommunity({ title: 'Closed Community' });
        await testDb.community.update({
          where: { id: doomed.id },
          data: { deletedAt: new Date('2024-03-01T10:00:00Z') },
        });

        const response = await testClient.post(
          '/sync',
          { lastSyncedAt: '2024-02-01T00:00:00Z', changes: [] },
          accessToken
        );

        const result = await response.json();
        expect(result.serverChanges.deleted).toContainEqual(
          expect.objectContaining({ entity: 'community', id: doomed.id, localId: null })
        );
        expect(result.serverChanges.lookups.communities.map((c: any) => c.id))
          .not.toContain(doomed.id);
      });

      it('should cover child records deleted by a family cascade', async () => {
        const family = await createTestFamily({ familyName: 'Cascade Family' });
        const child = await createTestChild(family.id, 'Ana');
        const parent = await createTestParent(family.id, 'Rosa');

        const deletedAt = new Date('2024-03-01T10:00:00Z');
        await testDb.child.update({ where: { id: child.id }, data: { deletedAt } });
        await testDb.parent.update({ where: { id: parent.id }, data: { deletedAt } });

        const response = await testClient.post(
          '/sync',
          { lastSyncedAt: '2024-02-01T00:00:00Z', changes: [] },
          accessToken
        );

        const result = await response.json();
        const entities = result.serverChanges.deleted.map((t: any) => `${t.entity}:${t.id}`);
        expect(entities).toContain(`child:${child.id}`);
        expect(entities).toContain(`parent:${parent.id}`);
      });
    });

    it('should handle birthing assistant with communities and trainings', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'birthingAssistant',
            operation: 'create',
            localId: '772f8522-f30c-52e5-b827-557766552222',
            data: {
              name: 'Maria Rodriguez',
              communityIds: [community.id],
              trainingIds: [training.id],
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('created');

      // Verify birthing assistant and associations were created
      const ba = await testDb.birthingAssistant.findUnique({
        where: { localId: '772f8522-f30c-52e5-b827-557766552222' },
        include: {
          servedCommunities: true,
          trainingsReceived: true,
        },
      });

      expect(ba).toBeTruthy();
      expect(ba?.name).toBe('Maria Rodriguez');
      expect(ba?.servedCommunities).toHaveLength(1);
      expect(ba?.servedCommunities[0].communityId).toBe(community.id);
      expect(ba?.trainingsReceived).toHaveLength(1);
      expect(ba?.trainingsReceived[0].trainingId).toBe(training.id);
    });

    it('should fail if parentLocalId cannot be resolved', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'child',
            operation: 'create',
            localId: '661f9511-f30c-52e5-b827-557766551111',
            parentLocalId: '99999999-9999-9999-9999-999999999999',
            data: {
              name: 'Orphan Child',
              birthDate: '2020-01-15T00:00:00Z',
              sex: 'FEMALE',
            },
            changedAt: '2024-03-01T11:45:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.message).toContain('Sync operation failed');
    });

    it('should require authentication', async () => {
      const syncRequest = {
        lastSyncedAt: null,
        changes: [],
      };

      const response = await testClient.post('/sync', syncRequest);
      expect(response.status).toBe(401);
    });

    it('should validate request body schema', async () => {
      const invalidRequest = {
        // Missing required fields
        changes: 'not an array',
      };

      const response = await testClient.post('/sync', invalidRequest, accessToken);
      expect(response.status).toBe(400);
    });

    it('should handle all entity types correctly', async () => {
      // First create dependencies
      const family = await createTestFamily();
      const child = await createTestChild(family.id);
      const parent = await createTestParent(family.id);

      const syncRequest = {
        lastSyncedAt: null,
        changes: [
          {
            entity: 'familyVisit',
            operation: 'create',
            localId: '883f9622-f40c-62f5-c938-668877663333',
            data: {
              familyId: family.id,
              visitDate: '2024-03-01T10:00:00Z',
              trainingsReceived: [{ id: training.id, title: 'Test Training' }],
              resourcesReceived: [],
              questions: [],
              notes: 'Family visit notes',
            },
            changedAt: '2024-03-01T11:30:00Z',
          },
          {
            entity: 'childVisit',
            operation: 'create',
            localId: '994f0733-f50d-73a6-d049-779988774444',
            data: {
              familyId: family.id,
              childId: child.id,
              visitDate: '2024-03-01T10:00:00Z',
              weight: 16,
              armCircumference: 140,
              height: 1000,
              incap: false,
              leche: true,
              questions: [],
              notes: 'Child visit notes',
            },
            changedAt: '2024-03-01T11:45:00Z',
          },
        ],
      };

      const response = await testClient.post('/sync', syncRequest, accessToken);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('created');
      expect(result.results[1].status).toBe('created');

      // Verify records were created
      const familyVisit = await testDb.familyVisit.findUnique({
        where: { localId: '883f9622-f40c-62f5-c938-668877663333' },
      });
      const childVisit = await testDb.childVisit.findUnique({
        where: { localId: '994f0733-f50d-73a6-d049-779988774444' },
      });

      expect(familyVisit).toBeTruthy();
      expect(childVisit).toBeTruthy();
      expect(familyVisit?.familyId).toBe(family.id);
      expect(childVisit?.familyId).toBe(family.id);
      expect(childVisit?.childId).toBe(child.id);
    });
  });
});
