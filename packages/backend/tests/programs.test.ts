import { describe, it, expect, beforeEach } from 'vitest';
import programsRoutes from '../src/routes/programs';
import {
  testDb,
  createTestUser,
  createTestChild,
  createTestProgram,
  createTestEnrollment,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/programs', programsRoutes);

describe('Programs Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });
    const admin = await createTestUser({ login: 'ad', email: 'ad@example.com', role: 'ADMIN' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);
    adminToken = tokenFor(admin);
  });

  describe('GET /programs', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await client.get('/programs');
      expect(res.status).toBe(401);
    });

    it('lets any role read the list', async () => {
      await createTestProgram({ name: 'Readable' });

      const res = await client.get('/programs', caseworkerToken);
      expect(res.status).toBe(200);
      expect((await res.json()).total).toBe(1);
    });

    it('orders by sortOrder', async () => {
      await createTestProgram({ name: 'Third', sortOrder: 30 });
      await createTestProgram({ name: 'First', sortOrder: 10 });
      await createTestProgram({ name: 'Second', sortOrder: 20 });

      const res = await client.get('/programs', caseworkerToken);
      const body = await res.json();

      expect(body.items.map((p: any) => p.name)).toEqual(['First', 'Second', 'Third']);
    });

    it('filters to active programs only', async () => {
      await createTestProgram({ name: 'On', active: true });
      await createTestProgram({ name: 'Off', active: false });

      const res = await client.get('/programs?activeOnly=true', caseworkerToken);
      const body = await res.json();

      expect(body.items.map((p: any) => p.name)).toEqual(['On']);
    });

    it('filters by kind', async () => {
      await createTestProgram({ name: 'Nutrition', kind: 'NUTRITION', subjectType: 'CHILD' });
      await createTestProgram({ name: 'Midwives', kind: 'MIDWIFE', subjectType: 'PERSON' });

      const res = await client.get('/programs?kind=MIDWIFE', caseworkerToken);
      const body = await res.json();

      expect(body.items.map((p: any) => p.name)).toEqual(['Midwives']);
    });

    it('counts active enrollments only', async () => {
      const program = await createTestProgram({ name: 'Counted' });

      const active = await createTestChild({ name: 'Active' });
      const exited = await createTestChild({ name: 'Exited' });

      await createTestEnrollment(program.id, { childId: active.id });
      await createTestEnrollment(program.id, { childId: exited.id }, {
        exitedAt: new Date('2026-05-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.get('/programs', caseworkerToken);
      const body = await res.json();

      expect(body.items[0].activeEnrollmentCount).toBe(1);
    });

    it('never exposes deletedAt', async () => {
      await createTestProgram({ name: 'Clean' });

      const res = await client.get('/programs', caseworkerToken);
      const body = await res.json();

      expect(body.items[0]).not.toHaveProperty('deletedAt');
    });
  });

  describe('POST /programs', () => {
    const validProgram = {
      name: 'Nutrition Infant <6m',
      kind: 'NUTRITION',
      subjectType: 'CHILD',
      minAgeMonths: 0,
      maxAgeMonths: 6,
      visitIntervalDays: 30,
    };

    it('refuses a caseworker', async () => {
      const res = await client.post('/programs', validProgram, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('refuses a supervisor', async () => {
      const res = await client.post('/programs', validProgram, supervisorToken);
      expect(res.status).toBe(403);
    });

    it('creates for an admin', async () => {
      const res = await client.post('/programs', validProgram, adminToken);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Nutrition Infant <6m');
      expect(body.visitIntervalDays).toBe(30);
      expect(body.minAgeMonths).toBe(0);
      expect(body.maxAgeMonths).toBe(6);
      expect(body.active).toBe(true);
    });

    it('defaults visitIntervalDays to null — never flag overdue', async () => {
      const res = await client.post(
        '/programs',
        { name: 'PAF', kind: 'FAMILY_PAF', subjectType: 'FAMILY' },
        adminToken
      );

      expect((await res.json()).visitIntervalDays).toBeNull();
    });

    it('rejects a kind/subjectType mismatch', async () => {
      const res = await client.post(
        '/programs',
        { name: 'Wrong', kind: 'NUTRITION', subjectType: 'MOTHER' },
        adminToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('requires subjectType CHILD');
    });

    it('rejects an inverted age band', async () => {
      const res = await client.post(
        '/programs',
        { name: 'Inverted', kind: 'NUTRITION', subjectType: 'CHILD', minAgeMonths: 12, maxAgeMonths: 6 },
        adminToken
      );

      expect(res.status).toBe(400);
    });

    it('rejects an unknown kind', async () => {
      const res = await client.post(
        '/programs',
        { name: 'X', kind: 'FORMULA', subjectType: 'CHILD' },
        adminToken
      );

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /programs/:id', () => {
    it('updates the mutable fields', async () => {
      const program = await createTestProgram({ name: 'Before' });

      const res = await client.put(
        `/programs/${program.id}`,
        { name: 'After', visitIntervalDays: 45, active: false },
        adminToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('After');
      expect(body.visitIntervalDays).toBe(45);
      expect(body.active).toBe(false);
    });

    it('ignores an attempt to change kind or subjectType', async () => {
      const program = await createTestProgram({
        name: 'Locked',
        kind: 'NUTRITION',
        subjectType: 'CHILD',
      });

      const res = await client.put(
        `/programs/${program.id}`,
        { kind: 'MIDWIFE', subjectType: 'PERSON', name: 'Renamed' },
        adminToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.kind).toBe('NUTRITION');
      expect(body.subjectType).toBe('CHILD');
      expect(body.name).toBe('Renamed');
    });

    it('refuses a non-admin', async () => {
      const program = await createTestProgram({ name: 'X' });

      const res = await client.put(`/programs/${program.id}`, { name: 'Y' }, supervisorToken);
      expect(res.status).toBe(403);
    });

    it('404s on a missing program', async () => {
      const res = await client.put('/programs/999999', { name: 'X' }, adminToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /programs/:id', () => {
    it('soft-deletes an empty program', async () => {
      const program = await createTestProgram({ name: 'Unused' });

      const res = await client.delete(`/programs/${program.id}`, adminToken);
      expect(res.status).toBe(200);

      const row = await testDb.program.findFirst({
        where: { id: program.id },
        includeDeleted: true,
      });
      expect(row.deletedAt).not.toBeNull();
    });

    it('refuses while active enrollments exist', async () => {
      const program = await createTestProgram({ name: 'Busy' });
      const child = await createTestChild({ name: 'Enrolled' });
      await createTestEnrollment(program.id, { childId: child.id });

      const res = await client.delete(`/programs/${program.id}`, adminToken);

      expect(res.status).toBe(409);
      expect((await res.json()).message).toContain('active enrollment');
    });

    it('allows deletion once every enrollment has exited', async () => {
      const program = await createTestProgram({ name: 'Finished' });
      const child = await createTestChild({ name: 'Graduated' });
      await createTestEnrollment(program.id, { childId: child.id }, {
        exitedAt: new Date('2026-06-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.delete(`/programs/${program.id}`, adminToken);
      expect(res.status).toBe(200);
    });

    it('refuses a non-admin', async () => {
      const program = await createTestProgram({ name: 'X' });

      const res = await client.delete(`/programs/${program.id}`, supervisorToken);
      expect(res.status).toBe(403);
    });
  });
});
