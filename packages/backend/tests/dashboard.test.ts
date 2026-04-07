// Set up environment variables BEFORE importing anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://calebr@127.0.0.1:5432/naru_test';

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import dashboardRoutes from '../src/routes/dashboard';
import { testDb, createTestUser, createTestFamily, createTestChild, createTestParent } from './setup';
import { appConfig } from '../src/config';

// Create test app with dashboard routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/', dashboardRoutes);

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

describe('Dashboard Routes', () => {
  let user: any;
  let accessToken: string;

  beforeEach(async () => {
    // Create test user
    user = await createTestUser({ role: 'CASEWORKER' });
    accessToken = createTokens(user.id, user.role);
  });

  describe('GET /dashboard', () => {
    it('should return dashboard data successfully', async () => {
      // Create test data
      const family = await createTestFamily({ inCrisis: false });
      const crisisFamily = await createTestFamily({ inCrisis: true });

      const child = await createTestChild(family.id);
      const crisisChild = await createTestChild(crisisFamily.id);

      // Create a child visit
      await testDb.childVisit.create({
        data: {
          familyId: family.id,
          childId: child.id,
          visitDate: new Date(),
          weight: 5000,
          armCircumference: 150,
          height: 700,
          incap: false,
          leche: true,
          notes: 'Test child visit',
        },
      });

      // Create a family visit
      await testDb.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: new Date(),
          notes: 'Test family visit',
        },
      });

      const response = await testClient.get('/', accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();

      // Check structure
      expect(data).toHaveProperty('recentVisits');
      expect(data.recentVisits).toHaveProperty('childVisits');
      expect(data.recentVisits).toHaveProperty('familyVisits');
      expect(data).toHaveProperty('recentlyUpdatedChildren');
      expect(data).toHaveProperty('familiesInCrisis');
      expect(data).toHaveProperty('stats');

      // Check that we have data
      expect(Array.isArray(data.recentVisits.childVisits)).toBe(true);
      expect(Array.isArray(data.recentVisits.familyVisits)).toBe(true);
      expect(Array.isArray(data.recentlyUpdatedChildren)).toBe(true);
      expect(Array.isArray(data.familiesInCrisis)).toBe(true);

      // Check that crisis families are included
      expect(data.familiesInCrisis.length).toBeGreaterThan(0);
      expect(data.familiesInCrisis[0]).toHaveProperty('inCrisis', true);
      expect(data.familiesInCrisis[0]).toHaveProperty('childrenCount');
      expect(data.familiesInCrisis[0]).toHaveProperty('lastVisitDate');

      // Check stats structure
      expect(data.stats).toHaveProperty('totalFamilies');
      expect(data.stats).toHaveProperty('totalChildren');
      expect(data.stats).toHaveProperty('familiesInCrisis');
      expect(data.stats).toHaveProperty('visitsThisMonth');

      // Check that stats have reasonable values
      expect(data.stats.totalFamilies).toBe(2);
      expect(data.stats.totalChildren).toBe(2);
      expect(data.stats.familiesInCrisis).toBe(1);
    });

    it('should return empty arrays when no data exists', async () => {
      const response = await testClient.get('/', accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.recentVisits.childVisits).toEqual([]);
      expect(data.recentVisits.familyVisits).toEqual([]);
      expect(data.recentlyUpdatedChildren).toEqual([]);
      expect(data.familiesInCrisis).toEqual([]);

      expect(data.stats.totalFamilies).toBe(0);
      expect(data.stats.totalChildren).toBe(0);
      expect(data.stats.familiesInCrisis).toBe(0);
      expect(data.stats.visitsThisMonth).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/');
      expect(response.status).toBe(401);
    });

    it('should include child details in recent child visits', async () => {
      const family = await createTestFamily();
      const child = await createTestChild(family.id, 'Test Child');

      await testDb.childVisit.create({
        data: {
          familyId: family.id,
          childId: child.id,
          visitDate: new Date(),
          weight: 5000,
          armCircumference: 150,
          height: 700,
          incap: false,
          leche: true,
          notes: 'Test visit with child details',
        },
      });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentVisits.childVisits.length).toBeGreaterThan(0);
      const childVisit = data.recentVisits.childVisits[0];
      expect(childVisit).toHaveProperty('child');
      expect(childVisit.child).toHaveProperty('id', child.id);
      expect(childVisit.child).toHaveProperty('name', 'Test Child');
      expect(childVisit.child).toHaveProperty('familyId', family.id);
    });

    it('should include family details in recent family visits', async () => {
      const family = await createTestFamily({ familyName: 'Test Family' });

      await testDb.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: new Date(),
          notes: 'Test family visit with details',
        },
      });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentVisits.familyVisits.length).toBeGreaterThan(0);
      const familyVisit = data.recentVisits.familyVisits[0];
      expect(familyVisit).toHaveProperty('family');
      expect(familyVisit.family).toHaveProperty('id', family.id);
      expect(familyVisit.family).toHaveProperty('familyName', 'Test Family');
    });

    it('should include latest visit info for recently updated children', async () => {
      const family = await createTestFamily();
      const child = await createTestChild(family.id, 'Updated Child');

      // Create a child visit
      const visit = await testDb.childVisit.create({
        data: {
          familyId: family.id,
          childId: child.id,
          visitDate: new Date(),
          weight: 6000,
          armCircumference: 160,
          height: 750,
          incap: true,
          leche: false,
        },
      });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentlyUpdatedChildren.length).toBeGreaterThan(0);
      const updatedChild = data.recentlyUpdatedChildren[0];
      expect(updatedChild).toHaveProperty('name', 'Updated Child');
      expect(updatedChild).toHaveProperty('family');
      expect(updatedChild.family).toHaveProperty('id', family.id);
      expect(updatedChild).toHaveProperty('latestVisit');
      expect(updatedChild.latestVisit).toHaveProperty('id', visit.id);
      expect(updatedChild.latestVisit).toHaveProperty('weight', 6000);
      expect(updatedChild.latestVisit).toHaveProperty('height', 750);
      expect(updatedChild.latestVisit).toHaveProperty('armCircumference', 160);
    });

    it('should handle children without visits in recently updated children', async () => {
      const family = await createTestFamily();
      const child = await createTestChild(family.id, 'Child No Visits');

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentlyUpdatedChildren.length).toBeGreaterThan(0);
      const childWithoutVisit = data.recentlyUpdatedChildren.find(c => c.name === 'Child No Visits');
      expect(childWithoutVisit).toBeDefined();
      expect(childWithoutVisit.latestVisit).toBeNull();
    });

    it('should properly format all datetime fields as ISO strings', async () => {
      const family = await createTestFamily();
      const child = await createTestChild(family.id);

      await testDb.childVisit.create({
        data: {
          familyId: family.id,
          childId: child.id,
          visitDate: new Date('2024-01-15T10:30:00Z'),
          weight: 5000,
          armCircumference: 150,
          height: 700,
        },
      });

      await testDb.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: new Date('2024-01-16T14:30:00Z'),
        },
      });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      // Check child visit dates
      if (data.recentVisits.childVisits.length > 0) {
        const childVisit = data.recentVisits.childVisits[0];
        expect(childVisit.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(childVisit.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(childVisit.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }

      // Check family visit dates
      if (data.recentVisits.familyVisits.length > 0) {
        const familyVisit = data.recentVisits.familyVisits[0];
        expect(familyVisit.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(familyVisit.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(familyVisit.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }

      // Check recently updated children dates
      if (data.recentlyUpdatedChildren.length > 0) {
        const updatedChild = data.recentlyUpdatedChildren[0];
        expect(updatedChild.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(updatedChild.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(updatedChild.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });
});