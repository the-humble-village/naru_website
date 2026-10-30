import { describe, it, expect, beforeEach } from 'vitest';
import enrollmentsRoutes from '../src/routes/enrollments';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestMother,
  createTestPerson,
  createTestChild,
  createTestCommunity,
  createTestProgram,
  createTestEnrollment,
  createTestVisit,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/enrollments', enrollmentsRoutes);

describe('Enrollments Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;

  let nutrition: any;
  let pregnancy: any;
  let midwives: any;
  let youth: any;
  let paf: any;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);

    nutrition = await createTestProgram({
      name: 'Nutrition Infant <6m',
      kind: 'NUTRITION',
      subjectType: 'CHILD',
      visitIntervalDays: 30,
    });
    pregnancy = await createTestProgram({
      name: 'Expectant Mother',
      kind: 'PREGNANCY',
      subjectType: 'MOTHER',
      visitIntervalDays: 30,
    });
    midwives = await createTestProgram({
      name: 'Midwives',
      kind: 'MIDWIFE',
      subjectType: 'PERSON',
    });
    youth = await createTestProgram({
      name: 'Youth',
      kind: 'STUDENT',
      subjectType: 'PERSON',
    });
    paf = await createTestProgram({
      name: 'PAF',
      kind: 'FAMILY_PAF',
      subjectType: 'FAMILY',
    });
  });

  describe('auth', () => {
    it('rejects an unauthenticated list', async () => {
      const res = await client.get('/enrollments');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /enrollments — subject rules', () => {
    it('enrols a child in a nutrition program with nothing but a date', async () => {
      const child = await createTestChild({ name: 'José' });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.childId).toBe(child.id);
      expect(body.enrolledAt).toBe('2026-05-02');
      expect(body.exitedAt).toBeNull();
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('admits a child with no mother and no family', async () => {
      const child = await createTestChild({ name: 'Orphaned', motherId: null, familyId: null });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-05-02', entryWeight: 3.1 },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      expect((await res.json()).entryWeight).toBe(3.1);
    });

    it('rejects a subject FK that does not match the program subjectType', async () => {
      const mother = await createTestMother({ name: 'María' });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, motherId: mother.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('expects a CHILD subject');
    });

    it('rejects zero subjects', async () => {
      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });

    it('rejects two subjects', async () => {
      const child = await createTestChild({ name: 'José' });
      const mother = await createTestMother({ name: 'María' });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, motherId: mother.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });

    it('404s on a missing subject', async () => {
      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: 999999, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });

    it('404s on a soft-deleted subject', async () => {
      const child = await createTestChild({ name: 'Gone' });
      await testDb.child.update({ where: { id: child.id }, data: { deletedAt: new Date() } });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });

    it('404s on a missing program', async () => {
      const child = await createTestChild({ name: 'José' });

      const res = await client.post(
        '/enrollments',
        { programId: 999999, childId: child.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });

    it('refuses an inactive program', async () => {
      const closed = await createTestProgram({ name: 'Closed', active: false });
      const child = await createTestChild({ name: 'José' });

      const res = await client.post(
        '/enrollments',
        { programId: closed.id, childId: child.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('inactive');
    });

    it('enrols a family in PAF and a person in Midwives', async () => {
      const family = await createTestFamily({ familyName: 'López' });
      const person = await createTestPerson({ name: 'Juana' });

      const pafRes = await client.post(
        '/enrollments',
        { programId: paf.id, familyId: family.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );
      const midwifeRes = await client.post(
        '/enrollments',
        { programId: midwives.id, personId: person.id, enrolledAt: '2026-05-02' },
        caseworkerToken
      );

      expect(pafRes.status).toBe(201);
      expect(midwifeRes.status).toBe(201);
    });
  });

  describe('POST /enrollments — one active enrollment per program', () => {
    it('rejects a second active enrollment in the same program', async () => {
      const child = await createTestChild({ name: 'José' });
      await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-06-01' },
        caseworkerToken
      );

      expect(res.status).toBe(409);
      expect((await res.json()).message).toContain('already has an active enrollment');
    });

    it('allows re-enrollment after an exit', async () => {
      const child = await createTestChild({ name: 'José' });
      await createTestEnrollment(nutrition.id, { childId: child.id }, {
        exitedAt: new Date('2026-04-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-06-01' },
        caseworkerToken
      );

      expect(res.status).toBe(201);
    });

    it('allows the same subject in two different programs at once', async () => {
      const person = await createTestPerson({ name: 'Juana' });
      await createTestEnrollment(midwives.id, { personId: person.id });

      const res = await client.post(
        '/enrollments',
        { programId: youth.id, personId: person.id, enrolledAt: '2026-06-01' },
        caseworkerToken
      );

      expect(res.status).toBe(201);
    });
  });

  describe('POST /enrollments — detail tables must match the kind', () => {
    it('stores a nutrition detail on a NUTRITION enrollment', async () => {
      const child = await createTestChild({ name: 'José' });

      const res = await client.post(
        '/enrollments',
        {
          programId: nutrition.id,
          childId: child.id,
          enrolledAt: '2026-05-02',
          nutritionDetail: {
            lengthAtAdmission: 540,
            caretakerName: 'Juana Ramírez',
            nutritionalStatus: 'MODERATE',
          },
        },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.nutritionDetail.lengthAtAdmission).toBe(540);
      expect(body.nutritionDetail.caretakerName).toBe('Juana Ramírez');
      expect(body.nutritionDetail.nutritionalStatus).toBe('MODERATE');
    });

    it('stores a pregnancy detail on a PREGNANCY enrollment', async () => {
      const mother = await createTestMother({ name: 'María' });

      const res = await client.post(
        '/enrollments',
        {
          programId: pregnancy.id,
          motherId: mother.id,
          enrolledAt: '2026-04-02',
          pregnancyDetail: { dueDate: '2026-11-15', pregnancyNumber: 3 },
        },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.pregnancyDetail.dueDate).toBe('2026-11-15');
      expect(body.pregnancyDetail.pregnancyNumber).toBe(3);
    });

    it('stores a student detail on a STUDENT enrollment', async () => {
      const person = await createTestPerson({ name: 'Pedro' });

      const res = await client.post(
        '/enrollments',
        {
          programId: youth.id,
          personId: person.id,
          enrolledAt: '2026-01-15',
          studentDetail: { school: 'Escuela Central', classYear: '5' },
        },
        caseworkerToken
      );

      expect(res.status).toBe(201);
      expect((await res.json()).studentDetail.school).toBe('Escuela Central');
    });

    it('rejects a pregnancy detail on a nutrition enrollment', async () => {
      const child = await createTestChild({ name: 'José' });

      const res = await client.post(
        '/enrollments',
        {
          programId: nutrition.id,
          childId: child.id,
          enrolledAt: '2026-05-02',
          pregnancyDetail: { pregnancyNumber: 1 },
        },
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('accepts only nutritionDetail');
    });

    it('rejects any detail on a MIDWIFE enrollment', async () => {
      const person = await createTestPerson({ name: 'Juana' });

      const res = await client.post(
        '/enrollments',
        {
          programId: midwives.id,
          personId: person.id,
          enrolledAt: '2026-05-02',
          studentDetail: { school: 'X' },
        },
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('accepts no enrollment detail');
    });

    it('404s on a missing birthing assistant', async () => {
      const mother = await createTestMother({ name: 'María' });

      const res = await client.post(
        '/enrollments',
        {
          programId: pregnancy.id,
          motherId: mother.id,
          enrolledAt: '2026-04-02',
          pregnancyDetail: { birthingAssistantId: 999999 },
        },
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });
  });

  describe('GET /enrollments', () => {
    it('defaults to active only', async () => {
      const active = await createTestChild({ name: 'Active' });
      const exited = await createTestChild({ name: 'Exited' });

      await createTestEnrollment(nutrition.id, { childId: active.id });
      await createTestEnrollment(nutrition.id, { childId: exited.id }, {
        exitedAt: new Date('2026-04-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.get('/enrollments', caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].subjectName).toBe('Active');
    });

    it('returns exited enrollments on request', async () => {
      const child = await createTestChild({ name: 'Exited' });
      await createTestEnrollment(nutrition.id, { childId: child.id }, {
        exitedAt: new Date('2026-04-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.get('/enrollments?status=exited', caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].exitReason).toBe('GRADUATED');
    });

    it('answers the census question with onDate', async () => {
      const early = await createTestChild({ name: 'Joined Jan' });
      const late = await createTestChild({ name: 'Joined Sep' });
      const left = await createTestChild({ name: 'Left Feb' });

      await createTestEnrollment(nutrition.id, { childId: early.id }, {
        enrolledAt: new Date('2026-01-10'),
      });
      await createTestEnrollment(nutrition.id, { childId: late.id }, {
        enrolledAt: new Date('2026-09-10'),
      });
      await createTestEnrollment(nutrition.id, { childId: left.id }, {
        enrolledAt: new Date('2026-01-10'),
        exitedAt: new Date('2026-02-10'),
        exitReason: 'MOVED_AWAY',
      });

      const res = await client.get('/enrollments?status=all&onDate=2026-06-01', caseworkerToken);
      const body = await res.json();

      expect(body.items.map((e: any) => e.subjectName)).toEqual(['Joined Jan']);
    });

    it('reports visit count and last visit date', async () => {
      const child = await createTestChild({ name: 'Visited' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      await createTestVisit(enrollment.id, { visitDate: new Date('2026-03-01') });
      await createTestVisit(enrollment.id, { visitDate: new Date('2026-04-15') });

      const res = await client.get('/enrollments', caseworkerToken);
      const body = await res.json();

      expect(body.items[0].visitCount).toBe(2);
      expect(body.items[0].lastVisitDate).toBe('2026-04-15');
    });

    it('excludes soft-deleted visits from the count', async () => {
      const child = await createTestChild({ name: 'Visited' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      await createTestVisit(enrollment.id, { visitDate: new Date('2026-03-01') });
      await createTestVisit(enrollment.id, {
        visitDate: new Date('2026-04-15'),
        deletedAt: new Date(),
      });

      const res = await client.get('/enrollments', caseworkerToken);
      const body = await res.json();

      expect(body.items[0].visitCount).toBe(1);
      expect(body.items[0].lastVisitDate).toBe('2026-03-01');
    });

    it('filters by program', async () => {
      const child = await createTestChild({ name: 'Child' });
      const mother = await createTestMother({ name: 'Mother' });

      await createTestEnrollment(nutrition.id, { childId: child.id });
      await createTestEnrollment(pregnancy.id, { motherId: mother.id });

      const res = await client.get(`/enrollments?programId=${pregnancy.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].subjectName).toBe('Mother');
      expect(body.items[0].program.kind).toBe('PREGNANCY');
    });

    it('filters by subject, giving the profile-page enrollment list', async () => {
      const mother = await createTestMother({ name: 'María' });
      const other = await createTestMother({ name: 'Other' });

      await createTestEnrollment(pregnancy.id, { motherId: mother.id });
      await createTestEnrollment(pregnancy.id, { motherId: other.id });

      const res = await client.get(`/enrollments?motherId=${mother.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].subjectName).toBe('María');
    });

    it('filters by the community of the subject', async () => {
      const xela = await createTestCommunity({ title: 'Xela' });
      const nahuala = await createTestCommunity({ title: 'Nahualá' });

      const here = await createTestChild({ name: 'In Xela', communityId: xela.id });
      const there = await createTestChild({ name: 'In Nahualá', communityId: nahuala.id });

      await createTestEnrollment(nutrition.id, { childId: here.id });
      await createTestEnrollment(nutrition.id, { childId: there.id });

      const res = await client.get(`/enrollments?communityId=${xela.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.items.map((e: any) => e.subjectName)).toEqual(['In Xela']);
    });

    it('filters by site, derived through the community', async () => {
      const site = await testDb.site.create({ data: { title: 'Quetzaltenango' } });
      const inSite = await createTestCommunity({ title: 'Xela', siteId: site.id });
      const noSite = await createTestCommunity({ title: 'Unassigned' });

      const here = await createTestChild({ name: 'In site', communityId: inSite.id });
      const there = await createTestChild({ name: 'No site', communityId: noSite.id });

      await createTestEnrollment(nutrition.id, { childId: here.id });
      await createTestEnrollment(nutrition.id, { childId: there.id });

      const res = await client.get(`/enrollments?siteId=${site.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.items.map((e: any) => e.subjectName)).toEqual(['In site']);
    });

    it('excludes soft-deleted enrollments', async () => {
      const child = await createTestChild({ name: 'Gone' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      await testDb.enrollment.update({
        where: { id: enrollment.id },
        data: { deletedAt: new Date() },
      });

      const res = await client.get('/enrollments', caseworkerToken);
      expect((await res.json()).total).toBe(0);
    });
  });

  describe('PUT /enrollments/:id', () => {
    it('updates admission fields', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.put(
        `/enrollments/${enrollment.id}`,
        { entryWeight: 3.4, admissionNotes: 'Referred by the clinic' },
        caseworkerToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entryWeight).toBe(3.4);
      expect(body.admissionNotes).toBe('Referred by the clinic');
    });

    it('creates the detail row when one did not exist', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.put(
        `/enrollments/${enrollment.id}`,
        { nutritionDetail: { caretakerName: 'Juana' } },
        caseworkerToken
      );

      expect(res.status).toBe(200);
      expect((await res.json()).nutritionDetail.caretakerName).toBe('Juana');
    });

    it('rejects a detail that does not match the kind', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.put(
        `/enrollments/${enrollment.id}`,
        { studentDetail: { school: 'X' } },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });

    it('ignores an attempt to move the enrollment to another subject', async () => {
      const child = await createTestChild({ name: 'José' });
      const other = await createTestChild({ name: 'Other' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.put(
        `/enrollments/${enrollment.id}`,
        { childId: other.id, entryWeight: 4 },
        caseworkerToken
      );

      expect(res.status).toBe(200);
      expect((await res.json()).childId).toBe(child.id);
    });

    it('refuses to move admission past an existing exit', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        enrolledAt: new Date('2026-01-10'),
        exitedAt: new Date('2026-02-10'),
        exitReason: 'GRADUATED',
      });

      const res = await client.put(
        `/enrollments/${enrollment.id}`,
        { enrolledAt: '2026-03-10' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });
  });

  describe('POST /enrollments/:id/exit', () => {
    it('exits with a reason and a weight', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        enrolledAt: new Date('2026-05-02'),
        entryWeight: 3.1,
      });

      const res = await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-09-20', exitReason: 'GRADUATED', exitWeight: 6.4 },
        caseworkerToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.exitedAt).toBe('2026-09-20');
      expect(body.exitReason).toBe('GRADUATED');
      expect(body.exitWeight).toBe(6.4);
      expect(body.entryWeight).toBe(3.1);
    });

    it('requires a reason', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-09-20' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });

    it('rejects an exit before the admission date', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        enrolledAt: new Date('2026-05-02'),
      });

      const res = await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-01-01', exitReason: 'GRADUATED' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain('earlier than the admission date');
    });

    it('rejects an unknown reason', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-09-20', exitReason: 'BORED' },
        caseworkerToken
      );

      expect(res.status).toBe(400);
    });

    it('refuses to exit twice', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        exitedAt: new Date('2026-06-01'),
        exitReason: 'GRADUATED',
      });

      const res = await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-09-20', exitReason: 'WITHDREW' },
        caseworkerToken
      );

      expect(res.status).toBe(409);
    });

    it('frees the subject to re-enrol', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      await client.post(
        `/enrollments/${enrollment.id}/exit`,
        { exitedAt: '2026-09-20', exitReason: 'GRADUATED' },
        caseworkerToken
      );

      const res = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-10-01' },
        caseworkerToken
      );

      expect(res.status).toBe(201);
    });
  });

  describe('POST /enrollments/:id/reopen', () => {
    it('refuses a caseworker', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        exitedAt: new Date('2026-06-01'),
        exitReason: 'DIED',
      });

      const res = await client.post(`/enrollments/${enrollment.id}/reopen`, undefined, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('clears every exit field for a supervisor', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        exitedAt: new Date('2026-06-01'),
        exitReason: 'DIED',
        exitWeight: 6.4,
        exitNotes: 'Mis-clicked',
      });

      const res = await client.post(`/enrollments/${enrollment.id}/reopen`, undefined, supervisorToken);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.exitedAt).toBeNull();
      expect(body.exitReason).toBeNull();
      expect(body.exitWeight).toBeNull();
      expect(body.exitNotes).toBeNull();
    });

    it('refuses to reopen an active enrollment', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.post(`/enrollments/${enrollment.id}/reopen`, undefined, supervisorToken);
      expect(res.status).toBe(409);
    });

    it('409s when the subject has since been re-enrolled', async () => {
      const child = await createTestChild({ name: 'José' });
      const old = await createTestEnrollment(nutrition.id, { childId: child.id }, {
        enrolledAt: new Date('2026-01-01'),
        exitedAt: new Date('2026-06-01'),
        exitReason: 'GRADUATED',
      });
      await createTestEnrollment(nutrition.id, { childId: child.id }, {
        enrolledAt: new Date('2026-07-01'),
      });

      const res = await client.post(`/enrollments/${old.id}/reopen`, undefined, supervisorToken);

      expect(res.status).toBe(409);
      expect((await res.json()).message).toContain('already has a different active enrollment');
    });
  });

  describe('DELETE /enrollments/:id', () => {
    it('refuses a caseworker', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.delete(`/enrollments/${enrollment.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft-deletes for a supervisor and frees the subject', async () => {
      const child = await createTestChild({ name: 'José' });
      const enrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

      const res = await client.delete(`/enrollments/${enrollment.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.enrollment.findFirst({
        where: { id: enrollment.id },
        includeDeleted: true,
      });
      expect(row.deletedAt).not.toBeNull();

      const reenrol = await client.post(
        '/enrollments',
        { programId: nutrition.id, childId: child.id, enrolledAt: '2026-10-01' },
        caseworkerToken
      );
      expect(reenrol.status).toBe(201);
    });

    it('404s on a missing enrollment', async () => {
      const res = await client.delete('/enrollments/999999', supervisorToken);
      expect(res.status).toBe(404);
    });
  });
});
