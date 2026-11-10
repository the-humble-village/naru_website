import { describe, it, expect, beforeEach } from 'vitest';
import visitsRoutes from '../src/routes/visits';
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
  createTestTraining,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/visits', visitsRoutes);

describe('Visits Routes', () => {
  let caseworker: any;
  let caseworkerToken: string;
  let supervisorToken: string;

  let nutrition: any;
  let pregnancy: any;
  let paf: any;

  // 2025-02-15 birth against a 2026-02-15 visit is exactly 365 days, which is a
  // populated row in both WHO tables — the assertions below depend on it.
  let child: any;
  let childEnrollment: any;
  let motherEnrollment: any;
  let familyEnrollment: any;

  beforeEach(async () => {
    caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);

    nutrition = await createTestProgram({
      name: 'Nutrition Infant',
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
    paf = await createTestProgram({
      name: 'PAF',
      kind: 'FAMILY_PAF',
      subjectType: 'FAMILY',
    });

    child = await createTestChild({ name: 'Ana', birthDate: new Date('2025-02-15'), sex: 'MALE' });
    childEnrollment = await createTestEnrollment(nutrition.id, { childId: child.id });

    const mother = await createTestMother({ name: 'María' });
    motherEnrollment = await createTestEnrollment(pregnancy.id, { motherId: mother.id });

    const family = await createTestFamily('López');
    familyEnrollment = await createTestEnrollment(paf.id, { familyId: family.id });
  });

  const newVisit = (overrides: any = {}) => ({
    enrollmentId: childEnrollment.id,
    visitDate: '2026-02-15',
    locationType: 'SITE',
    ...overrides,
  });

  describe('auth', () => {
    it('rejects an unauthenticated list', async () => {
      const res = await client.get('/visits');
      expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated create', async () => {
      const res = await client.post('/visits', newVisit());
      expect(res.status).toBe(401);
    });
  });

  describe('POST /visits', () => {
    it('records a visit on the spine and stamps the recording user', async () => {
      const res = await client.post('/visits', newVisit({ notes: 'Weighed in' }), caseworkerToken);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.enrollmentId).toBe(childEnrollment.id);
      expect(body.visitDate).toBe('2026-02-15');
      expect(body.locationType).toBe('SITE');
      expect(body.recordedById).toBe(caseworker.id);
      expect(body.resources).toEqual([]);
      expect(body.trainingIds).toEqual([]);
      expect(body.answers).toEqual([]);
      expect(body.nutritionDetail).toBeNull();
    });

    it('never exposes deletedAt', async () => {
      const res = await client.post('/visits', newVisit(), caseworkerToken);
      const body = await res.json();
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('404s on an unknown enrollment', async () => {
      const res = await client.post('/visits', newVisit({ enrollmentId: 999999 }), caseworkerToken);
      expect(res.status).toBe(404);
    });

    it('rejects a visit dated before admission', async () => {
      const res = await client.post('/visits', newVisit({ visitDate: '2025-12-01' }), caseworkerToken);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/earlier than the admission date/i);
    });

    it('rejects a duplicate localId', async () => {
      const localId = '11111111-1111-4111-8111-111111111111';
      await client.post('/visits', newVisit({ localId }), caseworkerToken);

      const res = await client.post('/visits', newVisit({ localId }), caseworkerToken);
      expect(res.status).toBe(400);
    });
  });

  describe('kind gating', () => {
    it('accepts a pregnancy detail on a PREGNANCY visit', async () => {
      const examType = await testDb.examinationType.create({ data: { title: 'Prenatal check' } });

      const res = await client.post(
        '/visits',
        newVisit({
          enrollmentId: motherEnrollment.id,
          pregnancyDetail: { weight: 64.1, gestationMonths: 7, examinationTypeId: examType.id },
        }),
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.pregnancyDetail).toMatchObject({ weight: 64.1, gestationMonths: 7 });
    });

    it('rejects a nutrition detail on a PREGNANCY visit', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ enrollmentId: motherEnrollment.id, nutritionDetail: { weight: 6 } }),
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/accepts only pregnancyDetail/);
    });

    it('rejects any detail on a FAMILY_PAF visit', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ enrollmentId: familyEnrollment.id, nutritionDetail: { weight: 6 } }),
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/accepts no visit detail/);
    });

    it('records a FAMILY_PAF visit on the spine alone', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ enrollmentId: familyEnrollment.id }),
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.pregnancyDetail).toBeNull();
      expect(body.nutritionDetail).toBeNull();
    });

    it('404s on an examination type that does not exist', async () => {
      const res = await client.post(
        '/visits',
        newVisit({
          enrollmentId: motherEnrollment.id,
          pregnancyDetail: { examinationTypeId: 999999 },
        }),
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });
  });

  describe('z-scores', () => {
    it('computes and persists all four z-scores plus the status', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { weight: 6.0, height: 700, armCircumference: 110 } }),
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const { nutritionDetail } = await res.json();

      expect(nutritionDetail.weightForAgeZ).toBeCloseTo(-4.28, 2);
      expect(nutritionDetail.muacZ).toBeCloseTo(-3.66, 2);
      expect(nutritionDetail.heightForAgeZ).toBeCloseTo(-2.42, 2);
      expect(nutritionDetail.weightForHeightZ).toBeCloseTo(-4.38, 2);
      expect(nutritionDetail.nutritionalStatus).toBe('SEVERE');
    });

    it('reads arm circumference as millimetres, not centimetres', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { armCircumference: 110 } }),
        caseworkerToken
      );

      // 110 mm is 11.0 cm — severe acute malnutrition. Passing 110 straight into
      // the WHO table as centimetres yields roughly +29.9, which would read NORMAL.
      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.muacZ).toBeLessThan(0);
      expect(nutritionDetail.nutritionalStatus).toBe('SEVERE');
    });

    it('lets MUAC override weight-for-age when both are present', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { weight: 6.0, armCircumference: 150 } }),
        caseworkerToken
      );

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.weightForAgeZ).toBeCloseTo(-4.28, 2);
      expect(nutritionDetail.muacZ).toBeCloseTo(0.31, 2);
      expect(nutritionDetail.nutritionalStatus).toBe('NORMAL');
    });

    it('falls back to weight-for-age when no arm circumference was taken', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { weight: 6.0 } }),
        caseworkerToken
      );

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.muacZ).toBeNull();
      expect(nutritionDetail.nutritionalStatus).toBe('SEVERE');
    });

    it('collapses an overweight reading into NORMAL', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { weight: 14.0 } }),
        caseworkerToken
      );

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.weightForAgeZ).toBeGreaterThan(2);
      expect(nutritionDetail.nutritionalStatus).toBe('NORMAL');
    });

    it('leaves the status null when nothing was measured', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ nutritionDetail: { weight: null } }),
        caseworkerToken
      );

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.nutritionalStatus).toBeNull();
    });
  });

  describe('join tables', () => {
    let incaparina: any;
    let milk: any;
    let handwashing: any;
    let question: any;

    beforeEach(async () => {
      incaparina = await testDb.resource.create({ data: { title: 'Incaparina', defaultUnit: 'bag' } });
      milk = await testDb.resource.create({ data: { title: 'Milk', defaultUnit: 'litre' } });
      handwashing = await createTestTraining('Handwashing');
      question = await testDb.question.create({
        data: { title: 'Does the family have chickens?', answerType: 'BOOL' },
      });
    });

    it('writes resources, trainings and answers in one go', async () => {
      const res = await client.post(
        '/visits',
        newVisit({
          resources: [
            { resourceId: incaparina.id, quantity: 2, unit: 'bag' },
            { resourceId: milk.id, quantity: 1.5, unit: 'litre' },
          ],
          trainingIds: [handwashing.id],
          answers: [{ questionId: question.id, valueBool: false }],
        }),
        caseworkerToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.resources).toHaveLength(2);
      expect(body.resources).toContainEqual({ resourceId: incaparina.id, quantity: 2, unit: 'bag' });
      expect(body.resources).toContainEqual({ resourceId: milk.id, quantity: 1.5, unit: 'litre' });
      expect(body.trainingIds).toEqual([handwashing.id]);
      expect(body.answers).toEqual([
        { questionId: question.id, valueText: null, valueNum: null, valueBool: false },
      ]);
    });

    it('rejects the same resource twice', async () => {
      const res = await client.post(
        '/visits',
        newVisit({
          resources: [
            { resourceId: incaparina.id, quantity: 1 },
            { resourceId: incaparina.id, quantity: 2 },
          ],
        }),
        caseworkerToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Duplicate resource id/);
    });

    it('404s on an unknown training', async () => {
      const res = await client.post('/visits', newVisit({ trainingIds: [999999] }), caseworkerToken);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/Training not found/);
    });

    it('404s on an unknown question', async () => {
      const res = await client.post(
        '/visits',
        newVisit({ answers: [{ questionId: 999999, valueText: 'x' }] }),
        caseworkerToken
      );

      expect(res.status).toBe(404);
    });

    it('writes nothing at all when one row of the payload is bad', async () => {
      await client.post(
        '/visits',
        newVisit({
          resources: [{ resourceId: incaparina.id, quantity: 2 }],
          trainingIds: [999999],
        }),
        caseworkerToken
      );

      expect(await testDb.visit.count()).toBe(0);
      expect(await testDb.visitResource.count()).toBe(0);
    });
  });

  describe('PUT /visits/:id', () => {
    let incaparina: any;
    let handwashing: any;
    let visitId: number;

    beforeEach(async () => {
      incaparina = await testDb.resource.create({ data: { title: 'Incaparina', defaultUnit: 'bag' } });
      handwashing = await createTestTraining('Handwashing');

      const res = await client.post(
        '/visits',
        newVisit({
          notes: 'first pass',
          resources: [{ resourceId: incaparina.id, quantity: 2, unit: 'bag' }],
          trainingIds: [handwashing.id],
          nutritionDetail: { weight: 6.0, armCircumference: 110 },
        }),
        caseworkerToken
      );

      visitId = (await res.json()).id;
    });

    it('leaves join rows alone when the key is absent', async () => {
      const res = await client.put(`/visits/${visitId}`, { notes: 'corrected' }, caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notes).toBe('corrected');
      expect(body.resources).toHaveLength(1);
      expect(body.trainingIds).toEqual([handwashing.id]);
    });

    it('replaces join rows wholesale when the key is present', async () => {
      const res = await client.put(`/visits/${visitId}`, { resources: [] }, caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.resources).toEqual([]);
      expect(body.trainingIds).toEqual([handwashing.id]);
      expect(await testDb.visitResource.count()).toBe(0);
    });

    it('recomputes z-scores when new measurements arrive', async () => {
      const res = await client.put(
        `/visits/${visitId}`,
        { nutritionDetail: { weight: 6.0, armCircumference: 150 } },
        caseworkerToken
      );

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.muacZ).toBeCloseTo(0.31, 2);
      expect(nutritionDetail.nutritionalStatus).toBe('NORMAL');
    });

    it('recomputes z-scores when only the visit date moves', async () => {
      // Same measurements, but the child is now 2 years old rather than 1, so the
      // WHO row is different and the stored scores would otherwise go stale.
      const res = await client.put(`/visits/${visitId}`, { visitDate: '2027-02-15' }, caseworkerToken);
      expect(res.status).toBe(200);

      const { nutritionDetail } = await res.json();
      expect(nutritionDetail.weightForAgeZ).not.toBeCloseTo(-4.28, 2);
    });

    it('rejects a nutrition detail on a pregnancy visit', async () => {
      const created = await client.post(
        '/visits',
        newVisit({ enrollmentId: motherEnrollment.id }),
        caseworkerToken
      );
      const id = (await created.json()).id;

      const res = await client.put(`/visits/${id}`, { nutritionDetail: { weight: 6 } }, caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('404s on an unknown visit', async () => {
      const res = await client.put('/visits/999999', { notes: 'x' }, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /visits', () => {
    beforeEach(async () => {
      await createTestVisit(childEnrollment.id, { visitDate: new Date('2026-03-01') });
      await createTestVisit(childEnrollment.id, { visitDate: new Date('2026-04-01') });
      await createTestVisit(motherEnrollment.id, { visitDate: new Date('2026-03-15') });
    });

    it('lists every visit, most recent first', async () => {
      const res = await client.get('/visits', caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.items[0].visitDate).toBe('2026-04-01');
      expect(body.items.map((v: any) => v.visitDate)).toEqual([
        '2026-04-01',
        '2026-03-15',
        '2026-03-01',
      ]);
    });

    it('carries the program and subject name', async () => {
      const res = await client.get(`/visits?enrollmentId=${motherEnrollment.id}`, caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].subjectName).toBe('María');
      expect(body.items[0].program.kind).toBe('PREGNANCY');
    });


    it('searches subject names before pagination and returns the filtered total', async () => {
      await testDb.child.update({ where: { id: child.id }, data: { name: 'Ana Lopez' } });
      const res = await client.get('/visits?search=%20LOPEZ%20ana%20&skip=1&limit=1', caseworkerToken);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].subjectName).toBe('Ana Lopez');
      expect(body.items[0].visitDate).toBe('2026-03-01');
    });

    it('searches mother, family and person names and combines search with other filters', async () => {
      await createTestVisit(familyEnrollment.id);
      const person = await createTestPerson({ name: 'Marta Perez' });
      const program = await createTestProgram({ name: 'Midwives', kind: 'MIDWIFE', subjectType: 'PERSON' });
      const enrollment = await createTestEnrollment(program.id, { personId: person.id });
      await createTestVisit(enrollment.id);
      for (const name of ['María', 'López', 'Marta Perez']) {
        const res = await client.get('/visits?search=' + encodeURIComponent(name), caseworkerToken);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.items[0].subjectName).toBe(name);
      }
      const filtered = await client.get(
        '/visits?search=Ana&from=2026-03-10&to=2026-04-10&programId=' + nutrition.id,
        caseworkerToken
      );
      expect((await filtered.json()).total).toBe(1);
      const noMatch = await client.get('/visits?search=Ana&programId=' + pregnancy.id, caseworkerToken);
      expect((await noMatch.json()).total).toBe(0);
    });

    it('treats search wildcard characters literally and ignores blank searches', async () => {
      const literal = await client.get('/visits?search=%25', caseworkerToken);
      expect((await literal.json()).total).toBe(0);
      const blank = await client.get('/visits?search=%20%20', caseworkerToken);
      expect((await blank.json()).total).toBe(3);
    });

    it('still excludes soft-deleted enrollments when searching', async () => {
      await testDb.enrollment.update({ where: { id: childEnrollment.id }, data: { deletedAt: new Date() } });
      const res = await client.get('/visits?search=Ana', caseworkerToken);
      expect((await res.json()).total).toBe(0);
    });

    it.each([
      [null, null, null],
      ['Ana', null, 'Ana'],
      [null, 'Perez', 'Perez'],
      [' Ana ', ' Perez ', 'Ana Perez'],
    ])('formats missing and partial recorder names (%s, %s)', async (firstName, lastName, expected) => {
      await testDb.user.update({ where: { id: caseworker.id }, data: { firstName, lastName } });
      const visit = await createTestVisit(childEnrollment.id, { recordedById: caseworker.id, visitDate: new Date('2026-05-01') });
      const res = await client.get('/visits?recordedById=' + caseworker.id, caseworkerToken);
      const body = await res.json();
      expect(body.items[0].id).toBe(visit.id);
      expect(body.items[0].recordedByName).toBe(expected);
    });

    it('filters by enrollment', async () => {
      const res = await client.get(`/visits?enrollmentId=${childEnrollment.id}`, caseworkerToken);
      expect((await res.json()).total).toBe(2);
    });

    it('filters by program', async () => {
      const res = await client.get(`/visits?programId=${pregnancy.id}`, caseworkerToken);
      expect((await res.json()).total).toBe(1);
    });

    it('filters by date range', async () => {
      const res = await client.get('/visits?from=2026-03-10&to=2026-03-31', caseworkerToken);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.items[0].visitDate).toBe('2026-03-15');
    });

    it('hides visits belonging to a soft-deleted enrollment', async () => {
      await testDb.enrollment.update({
        where: { id: childEnrollment.id },
        data: { deletedAt: new Date() },
      });

      const res = await client.get('/visits', caseworkerToken);
      expect((await res.json()).total).toBe(1);
    });
  });

  describe('GET /visits/:id', () => {
    it('fetches one visit', async () => {
      const visit = await createTestVisit(childEnrollment.id);
      const res = await client.get(`/visits/${visit.id}`, caseworkerToken);

      expect(res.status).toBe(200);
      expect((await res.json()).id).toBe(visit.id);
    });

    it('404s on an unknown visit', async () => {
      const res = await client.get('/visits/999999', caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /visits/:id', () => {
    it('refuses a caseworker', async () => {
      const visit = await createTestVisit(childEnrollment.id);
      const res = await client.delete(`/visits/${visit.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft deletes for a supervisor', async () => {
      const visit = await createTestVisit(childEnrollment.id);
      const res = await client.delete(`/visits/${visit.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.visit.findFirst({
        where: { id: visit.id },
        // @ts-expect-error — bypasses the soft-delete extension
        includeDeleted: true,
      });
      expect(row?.deletedAt).not.toBeNull();

      const list = await client.get('/visits', caseworkerToken);
      expect((await list.json()).total).toBe(0);
    });
  });

  describe('GET /visits/prefill', () => {
    it('falls back to the subject home community and its site', async () => {
      const site = await testDb.site.create({ data: { title: 'Quetzaltenango' } });
      const community = await createTestCommunity({ title: 'Xela', siteId: site.id });
      await testDb.child.update({ where: { id: child.id }, data: { communityId: community.id } });

      const res = await client.get(`/visits/prefill?enrollmentId=${childEnrollment.id}`, caseworkerToken);
      expect(res.status).toBe(200);

      expect(await res.json()).toEqual({
        locationType: 'SITE',
        siteId: site.id,
        communityId: community.id,
        source: 'SUBJECT_HOME',
      });
    });

    it('prefers the most recent visit on the enrollment', async () => {
      const community = await createTestCommunity({ title: 'Mobile stop' });
      await createTestVisit(childEnrollment.id, {
        visitDate: new Date('2026-03-01'),
        locationType: 'HOME',
      });
      await createTestVisit(childEnrollment.id, {
        visitDate: new Date('2026-04-01'),
        locationType: 'MOBILE_CLINIC',
        communityId: community.id,
      });

      const res = await client.get(`/visits/prefill?enrollmentId=${childEnrollment.id}`, caseworkerToken);

      expect(await res.json()).toEqual({
        locationType: 'MOBILE_CLINIC',
        siteId: null,
        communityId: community.id,
        source: 'PREVIOUS_VISIT',
      });
    });

    it('defaults to SITE when the subject has no community', async () => {
      const res = await client.get(`/visits/prefill?enrollmentId=${childEnrollment.id}`, caseworkerToken);

      expect(await res.json()).toEqual({
        locationType: 'SITE',
        siteId: null,
        communityId: null,
        source: 'DEFAULT',
      });
    });

    it('404s on an unknown enrollment', async () => {
      const res = await client.get('/visits/prefill?enrollmentId=999999', caseworkerToken);
      expect(res.status).toBe(404);
    });
  });
});
