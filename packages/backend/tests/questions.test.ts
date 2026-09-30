import { describe, it, expect, beforeEach } from 'vitest';
import questionsRoutes from '../src/routes/questions';
import questionSetsRoutes from '../src/routes/question-sets';
import { testDb, createTestUser, createTestProgram } from './setup';
import { mountRoutes, tokenFor } from './http';

const questions = mountRoutes('/questions', questionsRoutes);
const sets = mountRoutes('/question-sets', questionSetsRoutes);

describe('Questions Routes', () => {
  let caseworkerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const admin = await createTestUser({ login: 'ad', email: 'ad@example.com', role: 'ADMIN' });

    caseworkerToken = tokenFor(caseworker);
    adminToken = tokenFor(admin);
  });

  const chickens = { title: 'Does the family have chickens?', answerType: 'BOOL' };

  describe('auth and roles', () => {
    it('rejects an unauthenticated list', async () => {
      expect((await questions.get('/questions')).status).toBe(401);
    });

    it('lets a caseworker read — the visit form needs these', async () => {
      expect((await questions.get('/questions', caseworkerToken)).status).toBe(200);
    });

    it('refuses a caseworker write', async () => {
      const res = await questions.post('/questions', chickens, caseworkerToken);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /questions', () => {
    it('creates a question', async () => {
      const res = await questions.post('/questions', chickens, adminToken);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({ title: chickens.title, answerType: 'BOOL', choices: null, sortOrder: 0 });
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('creates a CHOICE question with choices', async () => {
      const res = await questions.post(
        '/questions',
        { title: 'Water source?', answerType: 'CHOICE', choices: ['Well', 'River', 'Tap'] },
        adminToken
      );

      expect(res.status).toBe(201);
      expect((await res.json()).choices).toEqual(['Well', 'River', 'Tap']);
    });

    it('rejects a CHOICE question with no choices', async () => {
      const res = await questions.post(
        '/questions',
        { title: 'Water source?', answerType: 'CHOICE' },
        adminToken
      );

      expect(res.status).toBe(400);
    });

    it('rejects choices on a non-CHOICE question', async () => {
      const res = await questions.post(
        '/questions',
        { title: 'Meals per day?', answerType: 'NUMBER', choices: ['1', '2'] },
        adminToken
      );

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /questions/:id', () => {
    it('rechecks choices against the merged result, not just the payload', async () => {
      const created = await questions.post(
        '/questions',
        { title: 'Water source?', answerType: 'CHOICE', choices: ['Well', 'Tap'] },
        adminToken
      );
      const id = (await created.json()).id;

      // Switching the type alone would strand the existing choices on a
      // non-CHOICE question, so it has to be rejected.
      const res = await questions.put(`/questions/${id}`, { answerType: 'TEXT' }, adminToken);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/only valid when answerType is CHOICE/);
    });

    it('allows the type and choices to change together', async () => {
      const created = await questions.post(
        '/questions',
        { title: 'Water source?', answerType: 'CHOICE', choices: ['Well', 'Tap'] },
        adminToken
      );
      const id = (await created.json()).id;

      const res = await questions.put(
        `/questions/${id}`,
        { answerType: 'TEXT', choices: null },
        adminToken
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answerType).toBe('TEXT');
      expect(body.choices).toBeNull();
    });

    it('rejects dropping choices from a question that stays CHOICE', async () => {
      const created = await questions.post(
        '/questions',
        { title: 'Water source?', answerType: 'CHOICE', choices: ['Well'] },
        adminToken
      );
      const id = (await created.json()).id;

      const res = await questions.put(`/questions/${id}`, { choices: null }, adminToken);
      expect(res.status).toBe(400);
    });

    it('404s on an unknown question', async () => {
      const res = await questions.put('/questions/999999', { title: 'x' }, adminToken);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /questions', () => {
    it('orders by sortOrder', async () => {
      await questions.post('/questions', { ...chickens, title: 'third', sortOrder: 3 }, adminToken);
      await questions.post('/questions', { ...chickens, title: 'first', sortOrder: 1 }, adminToken);
      await questions.post('/questions', { ...chickens, title: 'second', sortOrder: 2 }, adminToken);

      const res = await questions.get('/questions', caseworkerToken);
      expect((await res.json()).map((q: any) => q.title)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('DELETE /questions/:id', () => {
    it('soft deletes and hides from the list', async () => {
      const created = await questions.post('/questions', chickens, adminToken);
      const id = (await created.json()).id;

      expect((await questions.delete(`/questions/${id}`, adminToken)).status).toBe(200);
      expect(await (await questions.get('/questions', adminToken)).json()).toEqual([]);

      const row = await testDb.question.findFirst({
        where: { id },
        // @ts-expect-error — bypasses the soft-delete extension
        includeDeleted: true,
      });
      expect(row?.deletedAt).not.toBeNull();
    });

    it('keeps existing answers pointing at it', async () => {
      const created = await questions.post('/questions', chickens, adminToken);
      const id = (await created.json()).id;

      await questions.delete(`/questions/${id}`, adminToken);

      // The answer a worker recorded is still a fact after the question retires.
      expect(await testDb.question.count({ where: { id } })).toBe(0);
      const row = await testDb.question.findFirst({
        where: { id },
        // @ts-expect-error — bypasses the soft-delete extension
        includeDeleted: true,
      });
      expect(row).not.toBeNull();
    });
  });
});

describe('Question Sets Routes', () => {
  let caseworkerToken: string;
  let adminToken: string;
  let nutrition: any;
  let pregnancy: any;
  let chickens: any;
  let meals: any;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const admin = await createTestUser({ login: 'ad', email: 'ad@example.com', role: 'ADMIN' });

    caseworkerToken = tokenFor(caseworker);
    adminToken = tokenFor(admin);

    nutrition = await createTestProgram({ name: 'Nutrition', kind: 'NUTRITION', subjectType: 'CHILD' });
    pregnancy = await createTestProgram({ name: 'Pregnancy', kind: 'PREGNANCY', subjectType: 'MOTHER' });

    chickens = await testDb.question.create({
      data: { title: 'Chickens?', answerType: 'BOOL' },
    });
    meals = await testDb.question.create({
      data: { title: 'Meals per day?', answerType: 'NUMBER' },
    });
  });

  describe('POST /question-sets', () => {
    it('creates a set and orders items by the array order', async () => {
      const res = await sets.post(
        '/question-sets',
        { name: 'Household', programId: nutrition.id, questionIds: [meals.id, chickens.id] },
        adminToken
      );

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.name).toBe('Household');
      expect(body.programId).toBe(nutrition.id);
      expect(body.items.map((i: any) => i.questionId)).toEqual([meals.id, chickens.id]);
      expect(body.items.map((i: any) => i.sortOrder)).toEqual([0, 1]);
      expect(body.items[0]).toMatchObject({ questionTitle: 'Meals per day?', answerType: 'NUMBER' });
    });

    it('creates a shared set with no program', async () => {
      const res = await sets.post('/question-sets', { name: 'Common' }, adminToken);
      expect(res.status).toBe(201);
      expect((await res.json()).programId).toBeNull();
    });

    it('refuses a caseworker', async () => {
      const res = await sets.post('/question-sets', { name: 'Household' }, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('404s on an unknown program', async () => {
      const res = await sets.post('/question-sets', { name: 'X', programId: 999999 }, adminToken);
      expect(res.status).toBe(404);
    });

    it('404s on an unknown question', async () => {
      const res = await sets.post('/question-sets', { name: 'X', questionIds: [999999] }, adminToken);
      expect(res.status).toBe(404);
    });

    it('rejects the same question twice', async () => {
      const res = await sets.post(
        '/question-sets',
        { name: 'X', questionIds: [chickens.id, chickens.id] },
        adminToken
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Duplicate question id/);
    });
  });

  describe('GET /question-sets', () => {
    beforeEach(async () => {
      await sets.post('/question-sets', { name: 'Nutrition only', programId: nutrition.id }, adminToken);
      await sets.post('/question-sets', { name: 'Pregnancy only', programId: pregnancy.id }, adminToken);
      await sets.post('/question-sets', { name: 'Shared' }, adminToken);
    });

    it('lists everything by default', async () => {
      const res = await sets.get('/question-sets', caseworkerToken);
      expect((await res.json())).toHaveLength(3);
    });

    it('matches programId exactly without includeShared', async () => {
      const res = await sets.get(`/question-sets?programId=${nutrition.id}`, caseworkerToken);
      expect((await res.json()).map((s: any) => s.name)).toEqual(['Nutrition only']);
    });

    it('ORs in the shared sets with includeShared', async () => {
      const res = await sets.get(
        `/question-sets?programId=${nutrition.id}&includeShared=true`,
        caseworkerToken
      );

      expect((await res.json()).map((s: any) => s.name)).toEqual(['Nutrition only', 'Shared']);
    });
  });

  describe('PUT /question-sets/:id', () => {
    let setId: number;

    beforeEach(async () => {
      const created = await sets.post(
        '/question-sets',
        { name: 'Household', programId: nutrition.id, questionIds: [chickens.id, meals.id] },
        adminToken
      );
      setId = (await created.json()).id;
    });

    it('leaves membership alone when questionIds is absent', async () => {
      const res = await sets.put(`/question-sets/${setId}`, { name: 'Renamed' }, adminToken);
      const body = await res.json();

      expect(body.name).toBe('Renamed');
      expect(body.items).toHaveLength(2);
    });

    it('replaces membership wholesale when questionIds is present', async () => {
      const res = await sets.put(`/question-sets/${setId}`, { questionIds: [meals.id] }, adminToken);
      const body = await res.json();

      expect(body.items.map((i: any) => i.questionId)).toEqual([meals.id]);
      expect(await testDb.questionSetItem.count()).toBe(1);
    });

    it('reorders by resending the list', async () => {
      const res = await sets.put(
        `/question-sets/${setId}`,
        { questionIds: [meals.id, chickens.id] },
        adminToken
      );

      expect((await res.json()).items.map((i: any) => i.questionId)).toEqual([meals.id, chickens.id]);
    });

    it('empties the set with an empty array', async () => {
      const res = await sets.put(`/question-sets/${setId}`, { questionIds: [] }, adminToken);
      expect((await res.json()).items).toEqual([]);
    });

    it('404s on an unknown set', async () => {
      const res = await sets.put('/question-sets/999999', { name: 'x' }, adminToken);
      expect(res.status).toBe(404);
    });
  });

  describe('retired questions', () => {
    it('drops a soft-deleted question from the set it belongs to', async () => {
      const created = await sets.post(
        '/question-sets',
        { name: 'Household', questionIds: [chickens.id, meals.id] },
        adminToken
      );
      const setId = (await created.json()).id;

      await questions.delete(`/questions/${chickens.id}`, adminToken);

      // The item row survives, so historical answers stay readable, but a new
      // visit form must not offer the retired question.
      expect(await testDb.questionSetItem.count({ where: { setId } })).toBe(2);

      const res = await sets.get(`/question-sets/${setId}`, caseworkerToken);
      expect((await res.json()).items.map((i: any) => i.questionId)).toEqual([meals.id]);
    });

    it('keeps a retired question in the set when membership is rewritten', async () => {
      const created = await sets.post(
        '/question-sets',
        { name: 'Household', questionIds: [chickens.id, meals.id] },
        adminToken
      );
      const setId = (await created.json()).id;

      await questions.delete(`/questions/${chickens.id}`, adminToken);

      // The admin screen only ever sees the un-retired members, so saving a
      // reorder sends them back without the retired one. That must not evict it.
      const res = await sets.put(`/question-sets/${setId}`, { questionIds: [meals.id] }, adminToken);

      expect(res.status).toBe(200);
      expect((await res.json()).items.map((i: any) => i.questionId)).toEqual([meals.id]);

      const rows = await testDb.questionSetItem.findMany({ where: { setId } });
      expect(rows.map((r: any) => r.questionId).sort()).toEqual(
        [chickens.id, meals.id].sort()
      );
    });
  });

  describe('DELETE /question-sets/:id', () => {
    it('soft deletes and hides from the list', async () => {
      const created = await sets.post('/question-sets', { name: 'Household' }, adminToken);
      const setId = (await created.json()).id;

      expect((await sets.delete(`/question-sets/${setId}`, adminToken)).status).toBe(200);
      expect(await (await sets.get('/question-sets', adminToken)).json()).toEqual([]);
    });

    it('refuses a caseworker', async () => {
      const created = await sets.post('/question-sets', { name: 'Household' }, adminToken);
      const setId = (await created.json()).id;

      expect((await sets.delete(`/question-sets/${setId}`, caseworkerToken)).status).toBe(403);
    });
  });
});

describe('Question set soft-delete filtering', () => {
  it('404s a fetch of a soft-deleted set', async () => {
    const admin = await createTestUser({ login: 'ad2', email: 'ad2@example.com', role: 'ADMIN' });
    const token = tokenFor(admin);

    const created = await sets.post('/question-sets', { name: 'Gone' }, token);
    const setId = (await created.json()).id;

    await sets.delete(`/question-sets/${setId}`, token);

    expect((await sets.get(`/question-sets/${setId}`, token)).status).toBe(404);
    expect((await sets.put(`/question-sets/${setId}`, { name: 'x' }, token)).status).toBe(404);
  });
});
