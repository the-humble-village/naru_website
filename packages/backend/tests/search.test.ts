import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import searchRoutes from '../src/routes/search';
import { testDb, createTestUser, createTestFamily, createTestMother, createTestPerson, createTestChild } from './setup';
import { appConfig } from '../src/config';

// Create test app with search routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/search', searchRoutes);

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
};

describe('Search Routes', () => {
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
    testFamily = await createTestFamily({ familyName: 'Garcia Family' });
  });

  describe('GET /search', () => {
    it('should return empty results for empty query', async () => {
      const response = await testClient.get('/search?q=', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.query).toBe('');
    });

    it('should search families by name', async () => {
      // Create additional test family
      await createTestFamily({ familyName: 'Rodriguez Family' });
      await createTestFamily({ familyName: 'Smith Family' });

      const response = await testClient.get('/search?q=Garcia', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);

      const familyResult = result.results[0];
      expect(familyResult.type).toBe('family');
      expect(familyResult.name).toBe('Garcia Family');
      expect(familyResult.familyName).toBe('Garcia Family');
      expect(familyResult.id).toBeDefined();
      expect(familyResult.familyId).toBe(familyResult.id);
    });

    it('should search families case-insensitively', async () => {
      const response = await testClient.get('/search?q=garcia', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results[0].name).toBe('Garcia Family');
    });

    it('should search mothers by name', async () => {
      await createTestMother({ name: 'Maria Garcia', familyId: testFamily.id });

      const response = await testClient.get('/search?q=Maria', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);

      const motherResult = result.results[0];
      expect(motherResult.type).toBe('mother');
      expect(motherResult.name).toBe('Maria Garcia');
      expect(motherResult.familyName).toBe('Garcia Family');
      expect(motherResult.familyId).toBe(testFamily.id);
    });

    it('should search children by name', async () => {
      await createTestChild({ name: 'Carlos Garcia', familyId: testFamily.id });

      const response = await testClient.get('/search?q=Carlos', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);

      const childResult = result.results[0];
      expect(childResult.type).toBe('child');
      expect(childResult.name).toBe('Carlos Garcia');
      expect(childResult.familyName).toBe('Garcia Family');
      expect(childResult.familyId).toBe(testFamily.id);
    });

    it('should find a child with no family, which has no V1 equivalent', async () => {
      await createTestChild({ name: 'Orphaned Garcia' });

      const response = await testClient.get('/search?q=Orphaned', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('child');
      expect(result.results[0].familyId).toBeNull();
      expect(result.results[0].familyName).toBeNull();
    });

    it('should search across all types and sort by type (families, mothers, children, people)', async () => {
      await createTestMother({ name: 'Garcia Mother', familyId: testFamily.id });
      await createTestChild({ name: 'Garcia Child', familyId: testFamily.id, sex: 'FEMALE' });
      await createTestPerson({ name: 'Garcia Midwife' });

      const response = await testClient.get('/search?q=Garcia', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(4);
      expect(result.results).toHaveLength(4);

      expect(result.results.map((r: any) => r.type)).toEqual([
        'family',
        'mother',
        'child',
        'person',
      ]);

      // A person belongs to no family.
      expect(result.results[3].familyId).toBeNull();
    });

    it('should handle partial name matches', async () => {
      await createTestFamily({ familyName: 'Rodriguez-Martinez Family' });

      const response = await testClient.get('/search?q=Rodriguez', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results[0].name).toBe('Rodriguez-Martinez Family');
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/search?q=Garcia');
      expect(response.status).toBe(401);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await testClient.get('/search', caseworkerToken);
      expect(response.status).toBe(400);
    });

    it('should limit results to prevent excessive queries', async () => {
      // Create many families with similar names
      const promises = [];
      for (let i = 0; i < 60; i++) {
        promises.push(createTestFamily({ familyName: `Test Family ${i}` }));
      }
      await Promise.all(promises);

      const response = await testClient.get('/search?q=Test', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(50); // Limited to 50 per entity type
      expect(result.results.length).toBe(50);
      expect(result.results.length).toBeLessThanOrEqual(100); // Total limit is 100
    });

    it('should work for all user roles', async () => {
      // Test caseworker
      let response = await testClient.get('/search?q=Garcia', caseworkerToken);
      expect(response.status).toBe(200);

      // Test supervisor
      response = await testClient.get('/search?q=Garcia', supervisorToken);
      expect(response.status).toBe(200);

      // Test admin
      response = await testClient.get('/search?q=Garcia', adminToken);
      expect(response.status).toBe(200);
    });

    it('should handle special characters in search query', async () => {
      await createTestFamily({ familyName: "O'Connor Family" });

      const response = await testClient.get("/search?q=O'Connor", caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.total).toBe(1);
      expect(result.results[0].name).toBe("O'Connor Family");
    });

    it('should trim whitespace from query', async () => {
      const response = await testClient.get('/search?q=%20%20Garcia%20%20', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.query).toBe('Garcia');
      expect(result.total).toBe(1);
    });
  });
});
