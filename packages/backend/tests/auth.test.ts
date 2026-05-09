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
  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        login: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
        lang: 'en',
      };

      const response = await testClient.post('/auth/register', userData);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.user).toBeDefined();
      expect(result.user.login).toBe(userData.login);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.user.role).toBe('CASEWORKER');
      expect(result.user.lang).toBe('en');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify user was created in database
      const dbUser = await testDb.user.findUnique({
        where: { login: userData.login },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.login).toBe(userData.login);

      // Verify password was hashed
      const isValidPassword = await bcrypt.compare(userData.password, dbUser!.passwordHash);
      expect(isValidPassword).toBe(true);
    });

    it('should return 400 if user already exists', async () => {
      // Create a user first
      await testDb.user.create({
        data: {
          login: 'existinguser',
          email: 'existing@example.com',
          passwordHash: await bcrypt.hash('password', 10),
          role: 'CASEWORKER',
        },
      });

      const userData = {
        login: 'existinguser',
        password: 'password123',
      };

      const response = await testClient.post('/auth/register', userData);

      expect(response.status).toBe(400);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        expect(result.message).toContain('already exists');
      }
    });

    it('should validate required fields', async () => {
      const response = await testClient.post('/auth/register', {
        // Missing login and password
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });

    it('should validate password minimum length', async () => {
      const userData = {
        login: 'testuser',
        password: '123', // Too short
      };

      const response = await testClient.post('/auth/register', userData);

      expect(response.status).toBe(400);
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
});
