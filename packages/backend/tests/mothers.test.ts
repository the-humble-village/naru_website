import { describe, it, expect, beforeEach } from 'vitest';
import mothersRoutes from '../src/routes/mothers';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestMother,
  createTestPerson,
  createTestCommunity,
  createTestProgram,
  createTestEnrollment,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/mothers', mothersRoutes);

describe('Mothers Routes', () => {
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
      const res = await client.get('/mothers');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /mothers', () => {
    it('creates a mother with only a name', async () => {
      const res = await client.post('/mothers', { name: 'María López' }, caseworkerToken);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('María López');
      expect(body.familyId).toBeNull();
      expect(body.midwifeId).toBeNull();
    });

    it('never exposes deletedAt', async () => {
      const res = await client.post('/mothers', { name: 'No Deleted At' }, caseworkerToken);
      const body = await res.json();
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('stores the birth-history counts', async () => {
      const res = await client.post(
        '/mothers',
        { name: 'Counts', pregnancies: 3, childrenCount: 2, breastfedCount: 2, malnutritionDeaths: 0 },
        caseworkerToken
      );

      const body = await res.json();
      expect(body.pregnancies).toBe(3);
      expect(body.breastfedCount).toBe(2);
      expect(body.malnutritionDeaths).toBe(0);
    });

    it('links a family, community and midwife', async () => {
      const family = await createTestFamily({ familyName: 'López' });
      const community = await createTestCommunity({ title: 'Xela' });
      const midwife = await createTestPerson({ name: 'Juana' });

      const res = await client.post(
        '/mothers',
        { name: 'Linked', familyId: family.id, communityId: community.id, midwifeId: midwife.id },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.familyId).toBe(family.id);
      expect(body.communityId).toBe(community.id);
      expect(body.midwifeId).toBe(midwife.id);
    });

    it('404s on a missing family', async () => {
      const res = await client.post('/mothers', { name: 'X', familyId: 999999 }, caseworkerToken);
      expect(res.status).toBe(404);
    });

    it('404s on a missing midwife', async () => {
      const res = await client.post('/mothers', { name: 'X', midwifeId: 999999 }, caseworkerToken);
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const res = await client.post('/mothers', { name: '' }, caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate localId', async () => {
      const localId = '11111111-1111-4111-8111-111111111111';
      await client.post('/mothers', { name: 'First', localId }, caseworkerToken);

      const res = await client.post('/mothers', { name: 'Second', localId }, caseworkerToken);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /mothers', () => {
    it('filters by midwife — the caseload query', async () => {
      const midwife = await createTestPerson({ name: 'Juana' });
      await createTestMother({ name: 'Hers', midwifeId: midwife.id });
      await createTestMother({ name: 'Not hers' });

      const res = await client.get(`/mothers?midwifeId=${midwife.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('Hers');
    });

    it('filters by family', async () => {
      const family = await createTestFamily({ familyName: 'López' });
      await createTestMother({ name: 'In family', familyId: family.id });
      await createTestMother({ name: 'No family' });

      const res = await client.get(`/mothers?familyId=${family.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('In family');
    });

    it('filters by site through the community rollup', async () => {
      const site = await testDb.site.create({ data: { title: 'Quetzaltenango' } });
      const inSite = await createTestCommunity({ title: 'Xela', siteId: site.id });
      const elsewhere = await createTestCommunity({ title: 'Nahualá' });

      await createTestMother({ name: 'In site', communityId: inSite.id });
      await createTestMother({ name: 'Other site', communityId: elsewhere.id });
      await createTestMother({ name: 'No community' });

      const res = await client.get(`/mothers?siteId=${site.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('In site');
    });

    it('searches by name, case-insensitively', async () => {
      await createTestMother({ name: 'María López' });
      await createTestMother({ name: 'Rosa Tzul' });

      const res = await client.get('/mothers?search=maría', caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('María López');
    });

    it('returns only mothers with zero active enrollments when unenrolled=true', async () => {
      const program = await createTestProgram({
        name: 'Expectant Mother',
        kind: 'PREGNANCY',
        subjectType: 'MOTHER',
      });

      const enrolled = await createTestMother({ name: 'Enrolled' });
      const exited = await createTestMother({ name: 'Exited' });
      await createTestMother({ name: 'Never enrolled' });

      await createTestEnrollment(program.id, { motherId: enrolled.id });
      await createTestEnrollment(program.id, { motherId: exited.id }, {
        exitedAt: new Date('2026-03-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.get('/mothers?unenrolled=true', caseworkerToken);
      const body = await res.json();

      const names = body.items.map((m: any) => m.name).sort();
      expect(names).toEqual(['Exited', 'Never enrolled']);
    });

    it('excludes soft-deleted mothers', async () => {
      const mother = await createTestMother({ name: 'Gone' });
      await testDb.mother.update({ where: { id: mother.id }, data: { deletedAt: new Date() } });

      const res = await client.get('/mothers', caseworkerToken);
      const body = await res.json();

      expect(body.items.find((m: any) => m.id === mother.id)).toBeUndefined();
    });
  });

  describe('GET /mothers/:id', () => {
    it('returns the mother', async () => {
      const mother = await createTestMother({ name: 'Found' });

      const res = await client.get(`/mothers/${mother.id}`, caseworkerToken);
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe('Found');
    });

    it('404s on a missing mother', async () => {
      const res = await client.get('/mothers/999999', caseworkerToken);
      expect(res.status).toBe(404);
    });

    it('404s on a soft-deleted mother', async () => {
      const mother = await createTestMother({ name: 'Gone' });
      await testDb.mother.update({ where: { id: mother.id }, data: { deletedAt: new Date() } });

      const res = await client.get(`/mothers/${mother.id}`, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /mothers/:id', () => {
    it('updates fields', async () => {
      const mother = await createTestMother({ name: 'Before' });

      const res = await client.put(
        `/mothers/${mother.id}`,
        { name: 'After', pregnancies: 4 },
        caseworkerToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('After');
      expect(body.pregnancies).toBe(4);
    });

    it('clears the midwife link when passed null', async () => {
      const midwife = await createTestPerson({ name: 'Juana' });
      const mother = await createTestMother({ name: 'Has midwife', midwifeId: midwife.id });

      const res = await client.put(`/mothers/${mother.id}`, { midwifeId: null }, caseworkerToken);

      expect(res.status).toBe(200);
      expect((await res.json()).midwifeId).toBeNull();
    });

    it('404s on a missing mother', async () => {
      const res = await client.put('/mothers/999999', { name: 'X' }, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /mothers/:id', () => {
    it('refuses a caseworker', async () => {
      const mother = await createTestMother({ name: 'Keep' });

      const res = await client.delete(`/mothers/${mother.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft-deletes for a supervisor', async () => {
      const mother = await createTestMother({ name: 'Remove' });

      const res = await client.delete(`/mothers/${mother.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.mother.findFirst({
        where: { id: mother.id },
        includeDeleted: true,
      });
      expect(row.deletedAt).not.toBeNull();
    });

    it('404s on a missing mother', async () => {
      const res = await client.delete('/mothers/999999', supervisorToken);
      expect(res.status).toBe(404);
    });
  });
});
