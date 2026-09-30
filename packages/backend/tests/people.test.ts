import { describe, it, expect, beforeEach } from 'vitest';
import peopleRoutes from '../src/routes/people';
import {
  testDb,
  createTestUser,
  createTestMother,
  createTestPerson,
  createTestCommunity,
  createTestProgram,
  createTestEnrollment,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/people', peopleRoutes);

describe('People Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);
  });

  describe('auth', () => {
    it('rejects an unauthenticated list', async () => {
      const res = await client.get('/people');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /people', () => {
    it('creates a person with only a name', async () => {
      const res = await client.post('/people', { name: 'Juana Ramírez' }, caseworkerToken);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Juana Ramírez');
      expect(body.communityId).toBeNull();
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('accepts sex, phone and community', async () => {
      const community = await createTestCommunity({ title: 'Nahualá' });

      const res = await client.post(
        '/people',
        { name: 'Full', sex: 'FEMALE', phone: '5512-3344', communityId: community.id },
        caseworkerToken
      );

      const body = await res.json();
      expect(body.sex).toBe('FEMALE');
      expect(body.phone).toBe('5512-3344');
      expect(body.communityId).toBe(community.id);
    });

    it('404s on a missing community', async () => {
      const res = await client.post('/people', { name: 'X', communityId: 999999 }, caseworkerToken);
      expect(res.status).toBe(404);
    });

    it('rejects an invalid sex', async () => {
      const res = await client.post('/people', { name: 'X', sex: 'OTHER' }, caseworkerToken);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /people', () => {
    it('filters to the members of one program', async () => {
      const midwives = await createTestProgram({
        name: 'Midwives',
        kind: 'MIDWIFE',
        subjectType: 'PERSON',
      });
      const youth = await createTestProgram({
        name: 'Youth',
        kind: 'STUDENT',
        subjectType: 'PERSON',
      });

      const midwife = await createTestPerson({ name: 'A Midwife' });
      const student = await createTestPerson({ name: 'A Student' });

      await createTestEnrollment(midwives.id, { personId: midwife.id });
      await createTestEnrollment(youth.id, { personId: student.id });

      const res = await client.get(`/people?programId=${midwives.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('A Midwife');
    });

    it('excludes exited members from a program filter', async () => {
      const midwives = await createTestProgram({
        name: 'Midwives',
        kind: 'MIDWIFE',
        subjectType: 'PERSON',
      });
      const person = await createTestPerson({ name: 'Left' });

      await createTestEnrollment(midwives.id, { personId: person.id }, {
        exitedAt: new Date('2026-04-01'),
        exitReason: 'WITHDREW',
      });

      const res = await client.get(`/people?programId=${midwives.id}`, caseworkerToken);
      expect((await res.json()).total).toBe(0);
    });

    it('returns only people with zero active enrollments when unenrolled=true', async () => {
      const program = await createTestProgram({
        name: 'Youth',
        kind: 'STUDENT',
        subjectType: 'PERSON',
      });

      const enrolled = await createTestPerson({ name: 'Enrolled' });
      await createTestPerson({ name: 'Never enrolled' });
      await createTestEnrollment(program.id, { personId: enrolled.id });

      const res = await client.get('/people?unenrolled=true', caseworkerToken);
      const body = await res.json();

      expect(body.items.map((p: any) => p.name)).toEqual(['Never enrolled']);
    });

    it('excludes soft-deleted people', async () => {
      const person = await createTestPerson({ name: 'Gone' });
      await testDb.person.update({ where: { id: person.id }, data: { deletedAt: new Date() } });

      const res = await client.get('/people', caseworkerToken);
      expect((await res.json()).items).toHaveLength(0);
    });
  });

  describe('GET /people/:id/mothers', () => {
    it('returns the midwife caseload', async () => {
      const midwife = await createTestPerson({ name: 'Juana' });
      await createTestMother({ name: 'Rosa', midwifeId: midwife.id });
      await createTestMother({ name: 'Ana', midwifeId: midwife.id });
      await createTestMother({ name: 'Unassigned' });

      const res = await client.get(`/people/${midwife.id}/mothers`, caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.total).toBe(2);
      expect(body.items.map((m: any) => m.name)).toEqual(['Ana', 'Rosa']);
    });

    it('returns an empty caseload for a person who is not a midwife', async () => {
      const person = await createTestPerson({ name: 'Student' });

      const res = await client.get(`/people/${person.id}/mothers`, caseworkerToken);
      expect((await res.json()).total).toBe(0);
    });

    it('404s on a missing person', async () => {
      const res = await client.get('/people/999999/mothers', caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /people/:id', () => {
    it('updates a person', async () => {
      const person = await createTestPerson({ name: 'Before' });

      const res = await client.put(`/people/${person.id}`, { name: 'After' }, caseworkerToken);
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe('After');
    });

    it('404s on a missing person', async () => {
      const res = await client.put('/people/999999', { name: 'X' }, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /people/:id', () => {
    it('refuses a caseworker', async () => {
      const person = await createTestPerson({ name: 'Keep' });

      const res = await client.delete(`/people/${person.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft-deletes for a supervisor', async () => {
      const person = await createTestPerson({ name: 'Remove' });

      const res = await client.delete(`/people/${person.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.person.findFirst({ where: { id: person.id }, includeDeleted: true });
      expect(row.deletedAt).not.toBeNull();
    });
  });
});
