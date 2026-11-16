import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import healthRoutes from '../src/routes/health';
import { testDb, createTestUser } from './setup';
import { appConfig } from '../src/config';
import type { ZScoreResponse } from '@naru/shared';

// Create test app with health routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/health', healthRoutes);

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
};

describe('Health Routes', () => {
  beforeEach(async () => {
    // Clean tables via the setup hook
  });

  describe('POST /health/zscore', () => {
    it('should compute z-scores successfully for valid input', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test1@example.com', login: 'test1' });
      const accessToken = createTokens(user.id, user.role);

      const response = await testClient.post('/health/zscore', {
        weight: 3.5, // kg
        armCircumference: 110, // 11cm in millimeters
        birthDate: '2024-01-01T00:00:00Z',
        sex: 'MALE',
        referenceDate: '2024-01-31T00:00:00Z' // 30 days old
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json() as ZScoreResponse;

      expect(data.ageInDays).toBe(30);
      expect(data.weightForAge.value).not.toBeNull();
      expect(data.weightForAge.classification).toBeTruthy();
      expect(data.armCircumferenceForAge.value).toBeNull(); // ACFA not available before 91 days
      expect(data.armCircumferenceForAge.classification).toBeNull();
    });

    it('should compute arm circumference z-score for older child', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test2@example.com', login: 'test2' });
      const accessToken = createTokens(user.id, user.role);

      const response = await testClient.post('/health/zscore', {
        weight: 8, // kg
        armCircumference: 140, // 14cm in millimeters
        birthDate: '2023-01-01T00:00:00Z',
        sex: 'FEMALE',
        referenceDate: '2024-01-01T00:00:00Z' // 365 days old (1 year)
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json() as ZScoreResponse;

      expect(data.ageInDays).toBe(365);
      expect(data.weightForAge.value).not.toBeNull();
      expect(data.weightForAge.classification).toBeTruthy();
      expect(data.armCircumferenceForAge.value).not.toBeNull();
      expect(data.armCircumferenceForAge.classification).toBeTruthy();
    });

    it('should use current date when no reference date provided', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test3@example.com', login: 'test3' });
      const accessToken = createTokens(user.id, user.role);

      const birthDate = new Date();
      birthDate.setDate(birthDate.getDate() - 100); // 100 days ago

      const response = await testClient.post('/health/zscore', {
        weight: 5,
        birthDate: birthDate.toISOString(),
        sex: 'MALE'
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json() as ZScoreResponse;

      // Age should be approximately 100 days (give or take 1 day for timing)
      expect(data.ageInDays).toBeGreaterThanOrEqual(99);
      expect(data.ageInDays).toBeLessThanOrEqual(101);
    });

    it('should handle invalid birth date gracefully', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test4@example.com', login: 'test4' });
      const accessToken = createTokens(user.id, user.role);

      const response = await testClient.post('/health/zscore', {
        weight: 5,
        birthDate: '2025-01-01T00:00:00Z', // Future date
        sex: 'MALE',
        referenceDate: '2024-01-01T00:00:00Z'
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json() as ZScoreResponse;

      expect(data.ageInDays).toBeNull();
      expect(data.weightForAge.value).toBeNull();
      expect(data.weightForAge.classification).toBeNull();
      expect(data.armCircumferenceForAge.value).toBeNull();
      expect(data.armCircumferenceForAge.classification).toBeNull();
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.post('/health/zscore', {
        weight: 5,
        birthDate: '2024-01-01T00:00:00Z',
        sex: 'MALE'
      });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test5@example.com', login: 'test5' });
      const accessToken = createTokens(user.id, user.role);

      const response = await testClient.post('/health/zscore', {
        weight: -1, // Invalid negative weight
        birthDate: '2024-01-01T00:00:00Z',
        sex: 'MALE'
      }, accessToken);

      expect(response.status).toBe(400); // Validation error
    });

    it('should validate sex enum', async () => {
      const user = await createTestUser({ role: 'CASEWORKER', email: 'test6@example.com', login: 'test6' });
      const accessToken = createTokens(user.id, user.role);

      const response = await testClient.post('/health/zscore', {
        weight: 5,
        birthDate: '2024-01-01T00:00:00Z',
        sex: 'INVALID_SEX'
      }, accessToken);

      expect(response.status).toBe(400); // Validation error
    });

    it('should work for all user roles', async () => {
      for (const [index, role] of ['CASEWORKER', 'SUPERVISOR', 'ADMIN'].entries()) {
        const user = await createTestUser({
          role: role as 'CASEWORKER' | 'SUPERVISOR' | 'ADMIN',
          email: `test-${role.toLowerCase()}-${index}@example.com`,
          login: `test-${role.toLowerCase()}-${index}`
        });
        const accessToken = createTokens(user.id, user.role);

        const response = await testClient.post('/health/zscore', {
          weight: 5,
          birthDate: '2024-01-01T00:00:00Z',
          sex: 'MALE',
          referenceDate: '2024-02-01T00:00:00Z'
        }, accessToken);

        expect(response.status).toBe(200, `Role ${role} should have access`);
      }
    });
  });
});
