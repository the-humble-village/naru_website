import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import questionSetRoutes from '../src/routes/question-sets';
import { testDb, createTestUser } from './setup';
import { appConfig } from '../src/config';

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/question-sets', questionSetRoutes);

const createTokens = (userId: number, role: string, lang: string = 'en') =>
  jwt.sign({ userId, role, lang }, appConfig.JWT_SECRET, { expiresIn: '15m' });

const testClient = {
  get: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return app.request(new Request(`http://localhost${path}`, { method: 'GET', headers }));
  },
};

describe('Question Set Routes', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createTestUser({
      login: 'qsadmin',
      email: 'qsadmin@example.com',
      role: 'ADMIN',
    });
    adminToken = createTokens(admin.id, 'ADMIN');
  });

  describe('soft-deleted questions inside a set', () => {
    // The soft-delete extension only rewrites top-level `where` clauses, so a
    // set's `items` include used to keep serving items whose question had been
    // deleted — they rendered as blank rows in the admin UI.

    it('should exclude a soft-deleted question from the set it belongs to', async () => {
      const kept = await testDb.childVisitQuestion.create({ data: { title: 'Kept question' } });
      const doomed = await testDb.childVisitQuestion.create({ data: { title: 'Doomed question' } });

      const set = await testDb.childVisitQuestionSet.create({
        data: {
          name: 'Standard child intake',
          items: {
            create: [
              { questionId: kept.id, sortOrder: 0 },
              { questionId: doomed.id, sortOrder: 1 },
            ],
          },
        },
      });

      await testDb.childVisitQuestion.update({
        where: { id: doomed.id },
        data: { deletedAt: new Date() },
      });

      const listResponse = await testClient.get('/question-sets/child', adminToken);
      expect(listResponse.status).toBe(200);
      const sets = await listResponse.json();
      const listed = sets.find((s: any) => s.id === set.id);
      expect(listed.items.map((i: any) => i.questionId)).toEqual([kept.id]);

      const getResponse = await testClient.get(`/question-sets/child/${set.id}`, adminToken);
      expect(getResponse.status).toBe(200);
      const fetched = await getResponse.json();
      expect(fetched.items).toHaveLength(1);
      expect(fetched.items[0].questionTitle).toBe('Kept question');
    });

    it('should apply the same filtering to parent and family question sets', async () => {
      const parentQ = await testDb.parentVisitQuestion.create({ data: { title: 'Parent Q' } });
      const parentSet = await testDb.parentVisitQuestionSet.create({
        data: { name: 'Parent set', items: { create: [{ questionId: parentQ.id, sortOrder: 0 }] } },
      });
      const familyQ = await testDb.familyVisitQuestion.create({ data: { title: 'Family Q' } });
      const familySet = await testDb.familyVisitQuestionSet.create({
        data: { name: 'Family set', items: { create: [{ questionId: familyQ.id, sortOrder: 0 }] } },
      });

      await testDb.parentVisitQuestion.update({
        where: { id: parentQ.id },
        data: { deletedAt: new Date() },
      });
      await testDb.familyVisitQuestion.update({
        where: { id: familyQ.id },
        data: { deletedAt: new Date() },
      });

      const parentSets = await (await testClient.get('/question-sets/parent', adminToken)).json();
      expect(parentSets.find((s: any) => s.id === parentSet.id).items).toEqual([]);

      const familySets = await (await testClient.get('/question-sets/family', adminToken)).json();
      expect(familySets.find((s: any) => s.id === familySet.id).items).toEqual([]);
    });

    it('should filter at read time rather than destroying the junction row', async () => {
      const question = await testDb.childVisitQuestion.create({ data: { title: 'Doomed' } });
      const set = await testDb.childVisitQuestionSet.create({
        data: { name: 'Link set', items: { create: [{ questionId: question.id, sortOrder: 0 }] } },
      });

      await testDb.childVisitQuestion.update({
        where: { id: question.id },
        data: { deletedAt: new Date() },
      });

      expect((await (await testClient.get(`/question-sets/child/${set.id}`, adminToken)).json()).items)
        .toHaveLength(0);
      // The item row itself is untouched — the question is simply filtered out
      // on read, so nothing is lost if the deletion is later reversed.
      expect(await testDb.childVisitQuestionSetItem.count({ where: { setId: set.id } })).toBe(1);
    });
  });

  describe('soft-deleted question sets', () => {
    it('should hide a soft-deleted set from list and get', async () => {
      const set = await testDb.childVisitQuestionSet.create({ data: { name: 'Temporary set' } });
      await testDb.childVisitQuestionSet.update({
        where: { id: set.id },
        data: { deletedAt: new Date() },
      });

      const sets = await (await testClient.get('/question-sets/child', adminToken)).json();
      expect(sets.some((s: any) => s.id === set.id)).toBe(false);

      const getResponse = await testClient.get(`/question-sets/child/${set.id}`, adminToken);
      expect(getResponse.status).toBe(404);
    });
  });
});
