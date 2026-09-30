import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authRoutes from '../src/routes/auth';
import { testDb } from './setup';
import { appConfig } from '../src/config';

// Create test app with auth routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/auth', authRoutes);

// Helper to make requests
const testClient = {
  post: async (path: string, body?: any) => {
    const request = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return app.request(request);
  },
};

describe('Auth Routes', () => {
  // Self-service registration was removed: unauthenticated, it handed any caller
  // a CASEWORKER token and with it read access to every family's health records.
  // Accounts are created by an admin via POST /api/users. Guard against the route
  // being reintroduced by accident.
  describe('POST /register', () => {
    it('is not exposed', async () => {
      const response = await testClient.post('/auth/register', {
        login: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(404);

      const dbUser = await testDb.user.findUnique({ where: { login: 'newuser' } });
      expect(dbUser).toBeNull();
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await testDb.user.create({
        data: {
          login: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'SUPERVISOR',
          lang: 'es',
        },
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        login: 'testuser',
        password: 'password123',
      };

      const response = await testClient.post('/auth/login', loginData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.user).toBeDefined();
      expect(result.user.login).toBe('testuser');
      expect(result.user.role).toBe('SUPERVISOR');
      expect(result.user.lang).toBe('es');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify JWT tokens are valid
      const accessPayload = jwt.verify(result.accessToken, appConfig.JWT_SECRET) as any;
      expect(accessPayload.userId).toBeDefined();
      expect(accessPayload.role).toBe('SUPERVISOR');
      expect(accessPayload.lang).toBe('es');

      const refreshPayload = jwt.verify(result.refreshToken, appConfig.JWT_REFRESH_SECRET) as any;
      expect(refreshPayload.userId).toBeDefined();
      expect(refreshPayload.role).toBe('SUPERVISOR');
    });

    it('should return 401 for invalid login', async () => {
      const loginData = {
        login: 'nonexistent',
        password: 'password123',
      };

      const response = await testClient.post('/auth/login', loginData);

      expect(response.status).toBe(401);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Invalid credentials');
      }
    });

    it('should return 401 for invalid password', async () => {
      const loginData = {
        login: 'testuser',
        password: 'wrongpassword',
      };

      const response = await testClient.post('/auth/login', loginData);

      expect(response.status).toBe(401);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Invalid credentials');
      }
    });

    it('should validate required fields', async () => {
      const response = await testClient.post('/auth/login', {
        // Missing login and password
      });

      expect(response.status).toBe(400);
    });

    it('should not expose password hash in response', async () => {
      const loginData = {
        login: 'testuser',
        password: 'password123',
      };

      const response = await testClient.post('/auth/login', loginData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.user.passwordHash).toBeUndefined();
      expect(result.user.deletedAt).toBeUndefined();
    });
  });

  describe('POST /refresh', () => {
    let refreshToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create a test user
      const user = await testDb.user.create({
        data: {
          login: 'testuser',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'ADMIN',
          lang: 'en',
        },
      });
      userId = user.id;

      // Generate a valid refresh token
      refreshToken = jwt.sign(
        { userId: user.id, role: user.role, lang: user.lang },
        appConfig.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await testClient.post('/auth/refresh', { refreshToken });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.user.role).toBe('ADMIN');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify the new tokens are valid
      const accessPayload = jwt.verify(result.accessToken, appConfig.JWT_SECRET) as any;
      expect(accessPayload.userId).toBe(userId);
      expect(accessPayload.role).toBe('ADMIN');

      const newRefreshPayload = jwt.verify(result.refreshToken, appConfig.JWT_REFRESH_SECRET) as any;
      expect(newRefreshPayload.userId).toBe(userId);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await testClient.post('/auth/refresh', {
        refreshToken: 'invalid.refresh.token',
      });

      expect(response.status).toBe(401);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Invalid refresh token');
      }
    });

    it('should return 401 for expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId, role: 'ADMIN', lang: 'en' },
        appConfig.JWT_REFRESH_SECRET,
        { expiresIn: '-1d' } // Expired
      );

      const response = await testClient.post('/auth/refresh', {
        refreshToken: expiredToken,
      });

      expect(response.status).toBe(401);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('Invalid refresh token');
      }
    });

    it('should return 401 if user no longer exists', async () => {
      // Delete the user
      await testDb.user.delete({ where: { id: userId } });

      const response = await testClient.post('/auth/refresh', { refreshToken });

      expect(response.status).toBe(401);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('User not found');
      }
    });

    it('should validate required fields', async () => {
      const response = await testClient.post('/auth/refresh', {
        // Missing refreshToken
      });

      expect(response.status).toBe(400);
    });

    it('should not expose password hash in response', async () => {
      const response = await testClient.post('/auth/refresh', { refreshToken });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.user.passwordHash).toBeUndefined();
      expect(result.user.deletedAt).toBeUndefined();
    });
  });

  describe('token revocation (tokenVersion)', () => {
    let userId: number;

    beforeEach(async () => {
      const user = await testDb.user.create({
        data: {
          login: 'testuser',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'CASEWORKER',
          lang: 'en',
          tokenVersion: 2,
        },
      });
      userId = user.id;
    });

    it('stamps the current tokenVersion onto tokens issued by login', async () => {
      const response = await testClient.post('/auth/login', {
        login: 'testuser',
        password: 'password123',
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect((jwt.verify(result.accessToken, appConfig.JWT_SECRET) as any).tokenVersion).toBe(2);
      expect(
        (jwt.verify(result.refreshToken, appConfig.JWT_REFRESH_SECRET) as any).tokenVersion
      ).toBe(2);
      // Internal counter — must never reach the client on the user object.
      expect(result.user.tokenVersion).toBeUndefined();
    });

    // The half that matters: without this a refresh token stolen before a password
    // reset stays usable for its full 30 days and keeps minting access tokens.
    it('rejects a refresh token minted before the counter was bumped', async () => {
      const staleToken = jwt.sign(
        { userId, role: 'CASEWORKER', lang: 'en', tokenVersion: 2 },
        appConfig.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      await testDb.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });

      const response = await testClient.post('/auth/refresh', { refreshToken: staleToken });

      expect(response.status).toBe(401);
      expect((await response.json()).message).toContain('Session expired');
    });

    it('accepts a refresh token whose version still matches', async () => {
      const token = jwt.sign(
        { userId, role: 'CASEWORKER', lang: 'en', tokenVersion: 2 },
        appConfig.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      const response = await testClient.post('/auth/refresh', { refreshToken: token });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.user.tokenVersion).toBeUndefined();
      expect((jwt.verify(result.accessToken, appConfig.JWT_SECRET) as any).tokenVersion).toBe(2);
    });
  });
});
