import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userRoutes from '../src/routes/users';
import * as userService from '../src/services/user.service';
import * as authService from '../src/services/auth.service';
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
  delete: async (path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers,
    });
    return app.request(request);
  },
};

// Reads a user row bypassing the soft-delete extension, so tests can assert the
// row still exists and only carries a deletedAt stamp.
const findRowIncludingDeleted = async (id: number) =>
  testDb.user.findFirst({ where: { id }, includeDeleted: true });

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
        password: 'password12345',
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
      const isValidPassword = await bcrypt.compare('password12345', dbUser!.passwordHash);
      expect(isValidPassword).toBe(true);
    });

    it('should return 400 if user already exists', async () => {
      const userData = {
        login: 'admin', // Already exists
        password: 'password12345',
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
        password: 'password12345',
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
        password: 'password12345',
      });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.post('/users', {
        login: 'test',
        password: 'password12345',
      }, caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should return 400 when the login belongs to a soft-deleted user', async () => {
      await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);

      const response = await testClient.post('/users', {
        login: 'caseworker',
        password: 'password12345',
      }, adminToken);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /users/:id — role editing and password reset', () => {
    it('should let an admin edit every mutable field including role', async () => {
      const updateData = {
        login: 'promoted',
        email: 'promoted@example.com',
        firstName: 'Pro',
        lastName: 'Moted',
        role: 'ADMIN',
        lang: 'es',
      };

      const response = await testClient.put(`/users/${caseworkerUser.id}`, updateData, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject(updateData);
      expect(result.passwordHash).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();
    });

    it('should reset a password via PUT and never echo it back', async () => {
      const response = await testClient.put(
        `/users/${caseworkerUser.id}`,
        { password: 'brand-new-password' },
        adminToken
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.passwordHash).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();

      const dbUser = await testDb.user.findUnique({ where: { id: caseworkerUser.id } });
      expect(await bcrypt.compare('brand-new-password', dbUser!.passwordHash)).toBe(true);
      expect(await bcrypt.compare('password123', dbUser!.passwordHash)).toBe(false);
    });

    // 11 characters — one below the minimum, so this fails if the floor slips.
    it('should reject a password shorter than 12 characters', async () => {
      const response = await testClient.put(
        `/users/${caseworkerUser.id}`,
        { password: 'eleven-char' },
        adminToken
      );
      expect(response.status).toBe(400);
    });

    it('should accept a password of exactly 12 characters', async () => {
      const response = await testClient.put(
        `/users/${caseworkerUser.id}`,
        { password: 'twelve-chars' },
        adminToken
      );
      expect(response.status).toBe(200);
    });

    it('should return 400 when an admin demotes themselves out of ADMIN', async () => {
      // A second admin exists, so this can only be blocked by the self-guard
      await testDb.user.create({
        data: {
          login: 'admin2',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'ADMIN',
          lang: 'en',
        },
      });

      const response = await testClient.put(
        `/users/${adminUser.id}`,
        { role: 'CASEWORKER' },
        adminToken
      );
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.message).toMatch(/own role/i);

      const dbUser = await testDb.user.findUnique({ where: { id: adminUser.id } });
      expect(dbUser?.role).toBe('ADMIN');
    });

    it('should allow an admin to update their own non-role fields', async () => {
      const response = await testClient.put(
        `/users/${adminUser.id}`,
        { firstName: 'Still', role: 'ADMIN' },
        adminToken
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.firstName).toBe('Still');
      expect(result.role).toBe('ADMIN');
    });

    it('should let one admin demote another admin while admins remain', async () => {
      const admin2 = await testDb.user.create({
        data: {
          login: 'admin2',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'ADMIN',
          lang: 'en',
        },
      });

      const response = await testClient.put(`/users/${admin2.id}`, { role: 'SUPERVISOR' }, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.role).toBe('SUPERVISOR');
    });

    it('should refuse to demote the last remaining admin', async () => {
      // Guarded at the service layer: through the route the acting admin is
      // always an active admin, so the target can never be the last one.
      await expect(
        userService.updateUser(adminUser.id, { role: 'CASEWORKER' }, caseworkerUser.id)
      ).rejects.toMatchObject({ status: 400 });

      const dbUser = await testDb.user.findUnique({ where: { id: adminUser.id } });
      expect(dbUser?.role).toBe('ADMIN');
    });

    it('should return 404 when updating a soft-deleted user', async () => {
      await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);

      const response = await testClient.put(
        `/users/${caseworkerUser.id}`,
        { firstName: 'Resurrected' },
        adminToken
      );
      expect(response.status).toBe(404);

      const row = await findRowIncludingDeleted(caseworkerUser.id);
      expect(row?.firstName).toBe('Case');
    });
  });

  describe('POST /users/:id/password', () => {
    it('should reset another user password for admin', async () => {
      const response = await testClient.post(
        `/users/${caseworkerUser.id}/password`,
        { password: 'reset-password-1' },
        adminToken
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.id).toBe(caseworkerUser.id);
      expect(result.passwordHash).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();

      const dbUser = await testDb.user.findUnique({ where: { id: caseworkerUser.id } });
      expect(await bcrypt.compare('reset-password-1', dbUser!.passwordHash)).toBe(true);

      // The new password actually works for login
      const authResult = await authService.login({
        login: 'caseworker',
        password: 'reset-password-1',
      });
      expect(authResult.user.id).toBe(caseworkerUser.id);
    });

    it('should validate the minimum password length', async () => {
      const response = await testClient.post(
        `/users/${caseworkerUser.id}/password`,
        { password: 'eleven-char' }, // 11 — one below the minimum
        adminToken
      );
      expect(response.status).toBe(400);
    });

    it('should return 404 for a non-existent user', async () => {
      const response = await testClient.post('/users/99999/password', { password: 'password12345' }, adminToken);
      expect(response.status).toBe(404);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await testClient.post(
        `/users/${caseworkerUser.id}/password`,
        { password: 'password12345' },
        supervisorToken
      );
      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.post(`/users/${caseworkerUser.id}/password`, {
        password: 'password12345',
      });
      expect(response.status).toBe(401);
    });
  });

  // A password change must invalidate every token already out there. Anything that
  // is not a password change must not, or benign edits would sign people out.
  describe('tokenVersion bumping', () => {
    const versionOf = async (id: number) =>
      (await testDb.user.findUnique({ where: { id } }))!.tokenVersion;

    it('bumps on POST /users/:id/password', async () => {
      const before = await versionOf(caseworkerUser.id);

      await testClient.post(
        `/users/${caseworkerUser.id}/password`,
        { password: 'reset-password-1' },
        adminToken
      );

      expect(await versionOf(caseworkerUser.id)).toBe(before + 1);
    });

    it('bumps on PUT /users/:id when a password is supplied', async () => {
      const before = await versionOf(caseworkerUser.id);

      await testClient.put(
        `/users/${caseworkerUser.id}`,
        { password: 'brand-new-password' },
        adminToken
      );

      expect(await versionOf(caseworkerUser.id)).toBe(before + 1);
    });

    it('does not bump on PUT /users/:id without a password', async () => {
      const before = await versionOf(caseworkerUser.id);

      await testClient.put(
        `/users/${caseworkerUser.id}`,
        { firstName: 'Renamed', email: 'renamed@example.com' },
        adminToken
      );

      expect(await versionOf(caseworkerUser.id)).toBe(before);
    });

    // Authorization is re-read from the row on every request, so a demotion already
    // takes effect immediately. Bumping here would only sign users out on promotion.
    it('does not bump on a role change', async () => {
      const before = await versionOf(caseworkerUser.id);

      await testClient.put(`/users/${caseworkerUser.id}`, { role: 'SUPERVISOR' }, adminToken);

      expect(await versionOf(caseworkerUser.id)).toBe(before);
    });

    it('does not bump on PATCH /users/me/language', async () => {
      const before = await versionOf(caseworkerUser.id);

      await testClient.patch('/users/me/language', { lang: 'en' }, caseworkerToken);

      expect(await versionOf(caseworkerUser.id)).toBe(before);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should soft-delete a user for admin', async () => {
      const response = await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.message).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();

      // Row is still present, just stamped — never hard-deleted
      const row = await findRowIncludingDeleted(caseworkerUser.id);
      expect(row).toBeTruthy();
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it('should exclude a soft-deleted user from GET /users and GET /users/:id', async () => {
      await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);

      const listResponse = await testClient.get('/users', adminToken);
      const list = await listResponse.json();
      expect(list.users.some((u: any) => u.id === caseworkerUser.id)).toBe(false);
      expect(list.users.some((u: any) => u.login === 'caseworker')).toBe(false);
      expect(list.total).toBe(2);

      const getResponse = await testClient.get(`/users/${caseworkerUser.id}`, adminToken);
      expect(getResponse.status).toBe(404);
    });

    it('should prevent a soft-deleted user from logging in', async () => {
      // Sanity check: login works before the delete
      const before = await authService.login({ login: 'caseworker', password: 'password123' });
      expect(before.user.id).toBe(caseworkerUser.id);

      await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);

      await expect(
        authService.login({ login: 'caseworker', password: 'password123' })
      ).rejects.toMatchObject({ status: 401 });
    });

    it('should reject an admin deleting their own account', async () => {
      const response = await testClient.delete(`/users/${adminUser.id}`, adminToken);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.message).toMatch(/own account/i);

      const row = await findRowIncludingDeleted(adminUser.id);
      expect(row?.deletedAt).toBeNull();
    });

    it('should refuse to delete the last remaining admin', async () => {
      // Guarded at the service layer: through the route the acting admin is
      // always an active admin, so the target can never be the last one.
      await expect(
        userService.deleteUser(adminUser.id, caseworkerUser.id)
      ).rejects.toMatchObject({ status: 400 });

      const row = await findRowIncludingDeleted(adminUser.id);
      expect(row?.deletedAt).toBeNull();
    });

    it('should allow deleting an admin while another admin remains', async () => {
      const admin2 = await testDb.user.create({
        data: {
          login: 'admin2',
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'ADMIN',
          lang: 'en',
        },
      });

      const response = await testClient.delete(`/users/${admin2.id}`, adminToken);
      expect(response.status).toBe(200);

      const row = await findRowIncludingDeleted(admin2.id);
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it('should return 404 for a non-existent user', async () => {
      const response = await testClient.delete('/users/99999', adminToken);
      expect(response.status).toBe(404);
    });

    it('should return 404 for an already-deleted user', async () => {
      const first = await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);
      expect(first.status).toBe(200);

      const second = await testClient.delete(`/users/${caseworkerUser.id}`, adminToken);
      expect(second.status).toBe(404);
    });

    it('should return 403 for supervisor users', async () => {
      const response = await testClient.delete(`/users/${caseworkerUser.id}`, supervisorToken);
      expect(response.status).toBe(403);

      const row = await findRowIncludingDeleted(caseworkerUser.id);
      expect(row?.deletedAt).toBeNull();
    });

    it('should return 403 for caseworker users', async () => {
      const response = await testClient.delete(`/users/${supervisorUser.id}`, caseworkerToken);
      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testClient.delete(`/users/${caseworkerUser.id}`);
      expect(response.status).toBe(401);
    });
  });
});
