import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userRoutes from '../src/routes/users';
import { testDb } from './setup';
import { appConfig } from '../src/config';

// Create test app with user routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/users', userRoutes);

// Helper to create JWT token
const createToken = (userId: number, role: string, lang = 'en') => {
  return jwt.sign(
    { userId, role, lang },
    appConfig.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

// Helper to make authenticated requests
const testClient = {
  get: async (path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers,
    });
    return app.request(request);
  },
  post: async (path: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
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
  put: async (path: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
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
  patch: async (path: string, body?: any, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return app.request(request);
  },
};

describe('User Routes', () => {
  let adminUser: any;
  let caseworkerUser: any;
  let supervisorUser: any;
  let adminToken: string;
  let caseworkerToken: string;
  let supervisorToken: string;

  beforeEach(async () => {
    // Create test users AFTER the database cleanup
    // We need a slight delay to ensure the setup.ts beforeEach has completed
    await new Promise(resolve => setTimeout(resolve, 100));

    adminUser = await testDb.user.create({
      data: {
        login: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
        lang: 'en',
      },
    });

    caseworkerUser = await testDb.user.create({
      data: {
        login: 'caseworker',
        email: 'caseworker@example.com',
        firstName: 'Case',
        lastName: 'Worker',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'CASEWORKER',
        lang: 'es',
      },
    });

    supervisorUser = await testDb.user.create({
      data: {
        login: 'supervisor',
        email: 'supervisor@example.com',
        firstName: 'Super',
        lastName: 'Visor',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'SUPERVISOR',
        lang: 'en',
      },
    });

    // Create tokens
    adminToken = createToken(adminUser.id, 'ADMIN');
    caseworkerToken = createToken(caseworkerUser.id, 'CASEWORKER', 'es');
    supervisorToken = createToken(supervisorUser.id, 'SUPERVISOR');
  });

  describe('GET /users', () => {
    it('should list users for admin', async () => {
      const response = await testClient.get('/users', adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      // Should have at least the 3 users we created in beforeEach
      expect(result.users.length).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(3);

      // Check that users are returned with correct fields
      const user = result.users.find((u: any) => u.login === 'admin');
      expect(user).toBeDefined();
      expect(user.email).toBe('admin@example.com');
      expect(user.role).toBe('ADMIN');
      expect(user.passwordHash).toBeUndefined();
      expect(user.deletedAt).toBeUndefined();
    });

    it('should support pagination', async () => {
      // Test pagination with existing users (at least 3 users should exist from beforeEach)
      const response = await testClient.get('/users?skip=1&limit=2', adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.users.length).toBeGreaterThan(0); // Should get some users
      expect(result.users.length).toBeLessThanOrEqual(2); // Should respect limit
      expect(result.total).toBeGreaterThanOrEqual(3); // Should have at least 3 total users
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.get('/users');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.get('/users', caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should return 403 for supervisor users', async () => {
      const response = await testClient.get('/users', supervisorToken);
      expect(response.status).toBe(403);
    });
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const response = await testClient.get('/users/me', caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(caseworkerUser.id);
      expect(result.login).toBe('caseworker');
      expect(result.role).toBe('CASEWORKER');
      expect(result.lang).toBe('es');
      expect(result.passwordHash).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.get('/users/me');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should get user by ID for admin', async () => {
      const response = await testClient.get(`/users/${caseworkerUser.id}`, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(caseworkerUser.id);
      expect(result.login).toBe('caseworker');
      expect(result.role).toBe('CASEWORKER');
      expect(result.passwordHash).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await testClient.get('/users/99999', adminToken);
      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.get(`/users/${caseworkerUser.id}`);
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.get(`/users/${adminUser.id}`, caseworkerToken);
      expect(response.status).toBe(403);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user for admin', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
        role: 'SUPERVISOR',
      };

      const response = await testClient.put(`/users/${caseworkerUser.id}`, updateData, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.email).toBe('updated@example.com');
      expect(result.role).toBe('SUPERVISOR');

      // Verify in database
      const dbUser = await testDb.user.findUnique({
        where: { id: caseworkerUser.id },
      });
      expect(dbUser?.firstName).toBe('Updated');
      expect(dbUser?.role).toBe('SUPERVISOR');
    });

    it('should update login if unique', async () => {
      const updateData = {
        login: 'newlogin',
      };

      const response = await testClient.put(`/users/${caseworkerUser.id}`, updateData, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.login).toBe('newlogin');
    });

    it('should return 400 if login already exists', async () => {
      const updateData = {
        login: 'admin', // Already exists
      };

      const response = await testClient.put(`/users/${caseworkerUser.id}`, updateData, adminToken);
      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await testClient.put('/users/99999', { firstName: 'Test' }, adminToken);
      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.put(`/users/${caseworkerUser.id}`, { firstName: 'Test' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.put(`/users/${adminUser.id}`, { firstName: 'Test' }, caseworkerToken);
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /users/me/language', () => {
    it('should update current user language', async () => {
      const response = await testClient.patch('/users/me/language', { lang: 'fr' }, caseworkerToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.lang).toBe('fr');
      expect(result.id).toBe(caseworkerUser.id);

      // Verify in database
      const dbUser = await testDb.user.findUnique({
        where: { id: caseworkerUser.id },
      });
      expect(dbUser?.lang).toBe('fr');
    });

    it('should validate language field', async () => {
      const response = await testClient.patch('/users/me/language', { lang: '' }, caseworkerToken);
      expect(response.status).toBe(400);
    });

    it('should validate language max length', async () => {
      const response = await testClient.patch('/users/me/language', { lang: 'toolong' }, caseworkerToken);
      expect(response.status).toBe(400);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.patch('/users/me/language', { lang: 'es' });
      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await testClient.patch('/users/me/language', {}, caseworkerToken);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /users', () => {
    it('should create new user for admin', async () => {
      const userData = {
        login: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
        role: 'SUPERVISOR',
        lang: 'es',
      };

      const response = await testClient.post('/users', userData, adminToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.login).toBe('newuser');
      expect(result.email).toBe('newuser@example.com');
      expect(result.role).toBe('SUPERVISOR');
      expect(result.lang).toBe('es');
      expect(result.passwordHash).toBeUndefined();

      // Verify in database
      const dbUser = await testDb.user.findUnique({
        where: { login: 'newuser' },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe('newuser@example.com');

      // Verify password was hashed
      const isValidPassword = await bcrypt.compare('password123', dbUser!.passwordHash);
      expect(isValidPassword).toBe(true);
    });

    it('should return 400 if user already exists', async () => {
      const userData = {
        login: 'admin', // Already exists
        password: 'password123',
      };

      const response = await testClient.post('/users', userData, adminToken);
      expect(response.status).toBe(400);
    });

    it('should validate required fields', async () => {
      const response = await testClient.post('/users', {
        // Missing login and password
        email: 'test@example.com',
      }, adminToken);

      expect(response.status).toBe(400);
    });

    it('should validate password minimum length', async () => {
      const userData = {
        login: 'testuser',
        password: '123', // Too short
      };

      const response = await testClient.post('/users', userData, adminToken);
      expect(response.status).toBe(400);
    });

    it('should use default values', async () => {
      const userData = {
        login: 'defaultuser',
        password: 'password123',
      };

      const response = await testClient.post('/users', userData, adminToken);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.role).toBe('CASEWORKER'); // Default role
      expect(result.lang).toBe('en'); // Default language
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.post('/users', {
        login: 'test',
        password: 'password123',
      });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.post('/users', {
        login: 'test',
        password: 'password123',
      }, caseworkerToken);
      expect(response.status).toBe(403);
    });
  });
});
