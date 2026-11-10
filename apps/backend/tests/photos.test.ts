import { describe, it, expect, beforeEach } from 'vitest';
import photosRoutes from '../src/routes/photos';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestMother,
  createTestPerson,
  createTestChild,
  createTestProgram,
  createTestEnrollment,
  createTestVisit,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/photos', photosRoutes);

const createTestFile = async (overrides: any = {}) =>
  testDb.file.create({
    data: {
      extension: 'jpg',
      s3Key: `test/${Math.random().toString(36).slice(2)}.jpg`,
      mimeType: 'image/jpeg',
      size: 1024,
      confirmed: true,
      ...overrides,
    },
  });

describe('Photo Attachment Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;

  let file: any;
  let visit: any;
  let child: any;
  let mother: any;
  let person: any;
  let family: any;
  let event: any;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);

    file = await createTestFile();

    const program = await createTestProgram({ name: 'Nutrition', kind: 'NUTRITION', subjectType: 'CHILD' });
    child = await createTestChild({ name: 'Ana' });
    const enrollment = await createTestEnrollment(program.id, { childId: child.id });
    visit = await createTestVisit(enrollment.id);

    mother = await createTestMother({ name: 'María' });
    person = await createTestPerson({ name: 'Pedro' });
    family = await createTestFamily('López');
    event = await testDb.event.create({
      data: { name: 'Midwives Day', eventDate: new Date('2026-03-01') },
    });
  });

  const newPhoto = (overrides: any = {}) => ({
    fileId: file.id,
    ownerType: 'VISIT',
    ownerId: visit.id,
    ...overrides,
  });

  describe('auth', () => {
    it('rejects an unauthenticated list', async () => {
      const res = await client.get('/photos?ownerType=VISIT&ownerId=1');
      expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated create', async () => {
      const res = await client.post('/photos', newPhoto());
      expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated delete', async () => {
      const res = await client.delete('/photos/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /photos', () => {
    it('creates an attachment on a visit', async () => {
      const res = await client.post('/photos', newPhoto({ caption: 'Before' }), caseworkerToken);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        fileId: file.id,
        ownerType: 'VISIT',
        ownerId: visit.id,
        caption: 'Before',
        sortOrder: 0,
      });
      expect(body).not.toHaveProperty('deletedAt');
    });

    it.each([
      ['CHILD', () => child.id],
      ['MOTHER', () => mother.id],
      ['PERSON', () => person.id],
      ['FAMILY', () => family.id],
      ['EVENT', () => event.id],
    ])('accepts a %s owner', async (ownerType, id) => {
      const res = await client.post(
        '/photos',
        newPhoto({ ownerType, ownerId: id() }),
        caseworkerToken
      );
      expect(res.status).toBe(201);
    });

    it('rejects an unknown ownerType', async () => {
      const res = await client.post('/photos', newPhoto({ ownerType: 'DOG' }), caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('rejects a missing fileId', async () => {
      const res = await client.post('/photos', { ownerType: 'VISIT', ownerId: visit.id }, caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('404s when the file does not exist', async () => {
      const res = await client.post('/photos', newPhoto({ fileId: 999999 }), caseworkerToken);
      expect(res.status).toBe(404);
      expect((await res.json()).message).toContain('File');
    });

    // photo_attachment.ownerId has no FK (SCHEMA_V2.md §7.5) — these two are the
    // whole reason the service does a polymorphic existence check.
    it('404s when ownerId does not exist anywhere', async () => {
      const res = await client.post('/photos', newPhoto({ ownerId: 999999 }), caseworkerToken);
      expect(res.status).toBe(404);
      expect((await res.json()).message).toContain('Visit');
    });

    it('404s when ownerId exists but in the wrong table', async () => {
      // An explicit id no sequence in this suite will reach, so 424242 is a real
      // person and definitively not a visit.
      await createTestPerson({ id: 424242, name: 'Solo' });

      const wrongTable = await client.post(
        '/photos',
        newPhoto({ ownerType: 'VISIT', ownerId: 424242 }),
        caseworkerToken
      );
      expect(wrongTable.status).toBe(404);
      expect((await wrongTable.json()).message).toContain('Visit');

      const rightTable = await client.post(
        '/photos',
        newPhoto({ ownerType: 'PERSON', ownerId: 424242 }),
        caseworkerToken
      );
      expect(rightTable.status).toBe(201);
    });

    it('404s when the named owner is soft-deleted', async () => {
      await testDb.child.update({ where: { id: child.id }, data: { deletedAt: new Date() } });

      const res = await client.post(
        '/photos',
        newPhoto({ ownerType: 'CHILD', ownerId: child.id }),
        caseworkerToken
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /photos', () => {
    beforeEach(async () => {
      await client.post('/photos', newPhoto({ caption: 'third', sortOrder: 3 }), caseworkerToken);
      await client.post('/photos', newPhoto({ caption: 'first', sortOrder: 1 }), caseworkerToken);
      await client.post('/photos', newPhoto({ caption: 'second', sortOrder: 2 }), caseworkerToken);
      await client.post(
        '/photos',
        newPhoto({ ownerType: 'CHILD', ownerId: child.id, caption: 'other owner' }),
        caseworkerToken
      );
    });

    it('filters by owner and orders by sortOrder', async () => {
      const res = await client.get(`/photos?ownerType=VISIT&ownerId=${visit.id}`, caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.skip).toBe(0);
      expect(body.limit).toBe(50);
      expect(body.items.map((p: any) => p.caption)).toEqual(['first', 'second', 'third']);
      expect(body.items[0]).not.toHaveProperty('deletedAt');
    });

    it('rejects ownerType without ownerId', async () => {
      const res = await client.get('/photos?ownerType=VISIT', caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('paginates', async () => {
      const res = await client.get(
        `/photos?ownerType=VISIT&ownerId=${visit.id}&skip=1&limit=1`,
        caseworkerToken
      );
      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].caption).toBe('second');
    });
  });

  describe('GET /photos/:id', () => {
    it('fetches one', async () => {
      const created = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();
      const res = await client.get(`/photos/${created.id}`, caseworkerToken);
      expect(res.status).toBe(200);
      expect((await res.json()).id).toBe(created.id);
    });

    it('404s for a missing id', async () => {
      const res = await client.get('/photos/999999', caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /photos/:id', () => {
    it('updates caption and sortOrder', async () => {
      const created = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();

      const res = await client.put(
        `/photos/${created.id}`,
        { caption: 'Updated', sortOrder: 7 },
        caseworkerToken
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.caption).toBe('Updated');
      expect(body.sortOrder).toBe(7);
    });

    // Re-pointing an attachment would silently move a photo between patients.
    it('ignores attempts to change fileId, ownerType or ownerId', async () => {
      const created = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();
      const otherFile = await createTestFile();

      const res = await client.put(
        `/photos/${created.id}`,
        { fileId: otherFile.id, ownerType: 'CHILD', ownerId: child.id, caption: 'moved?' },
        caseworkerToken
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.fileId).toBe(file.id);
      expect(body.ownerType).toBe('VISIT');
      expect(body.ownerId).toBe(visit.id);
      expect(body.caption).toBe('moved?');
    });

    it('404s for a missing id', async () => {
      const res = await client.put('/photos/999999', { caption: 'x' }, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /photos/:id', () => {
    it('rejects a caseworker', async () => {
      const created = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();
      const res = await client.delete(`/photos/${created.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft deletes for a supervisor and hides the row', async () => {
      const created = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();

      const res = await client.delete(`/photos/${created.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.photoAttachment.findFirst({
        where: { id: created.id },
        includeDeleted: true,
      });
      expect(row?.deletedAt).not.toBeNull();

      const list = await (
        await client.get(`/photos?ownerType=VISIT&ownerId=${visit.id}`, caseworkerToken)
      ).json();
      expect(list.total).toBe(0);

      const fetched = await client.get(`/photos/${created.id}`, caseworkerToken);
      expect(fetched.status).toBe(404);
    });

    it('404s for a missing id', async () => {
      const res = await client.delete('/photos/999999', supervisorToken);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /photos/reorder', () => {
    it('rewrites sortOrder to the given order', async () => {
      const a = await (await client.post('/photos', newPhoto({ caption: 'a' }), caseworkerToken)).json();
      const b = await (await client.post('/photos', newPhoto({ caption: 'b' }), caseworkerToken)).json();
      const c = await (await client.post('/photos', newPhoto({ caption: 'c' }), caseworkerToken)).json();

      const res = await client.post(
        '/photos/reorder',
        { ownerType: 'VISIT', ownerId: visit.id, photoIds: [c.id, a.id, b.id] },
        caseworkerToken
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.items.map((p: any) => p.caption)).toEqual(['c', 'a', 'b']);
    });

    it('404s when a photo belongs to another owner', async () => {
      const mine = await (await client.post('/photos', newPhoto(), caseworkerToken)).json();
      const theirs = await (
        await client.post('/photos', newPhoto({ ownerType: 'CHILD', ownerId: child.id }), caseworkerToken)
      ).json();

      const res = await client.post(
        '/photos/reorder',
        { ownerType: 'VISIT', ownerId: visit.id, photoIds: [mine.id, theirs.id] },
        caseworkerToken
      );
      expect(res.status).toBe(404);
    });

    it('404s when the owner does not exist', async () => {
      const res = await client.post(
        '/photos/reorder',
        { ownerType: 'VISIT', ownerId: 999999, photoIds: [1] },
        caseworkerToken
      );
      expect(res.status).toBe(404);
    });

    it('rejects an empty photoIds list', async () => {
      const res = await client.post(
        '/photos/reorder',
        { ownerType: 'VISIT', ownerId: visit.id, photoIds: [] },
        caseworkerToken
      );
      expect(res.status).toBe(400);
    });
  });
});
