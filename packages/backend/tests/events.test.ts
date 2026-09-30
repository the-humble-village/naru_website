import { describe, it, expect, beforeEach } from 'vitest';
import eventsRoutes from '../src/routes/events';
import visitsRoutes from '../src/routes/visits';
import {
  testDb,
  createTestUser,
  createTestChild,
  createTestProgram,
  createTestEnrollment,
  createTestVisit,
} from './setup';
import { mountRoutes, tokenFor } from './http';

const client = mountRoutes('/events', eventsRoutes);
const visitClient = mountRoutes('/visits', visitsRoutes);

describe('Event Routes', () => {
  let caseworkerToken: string;
  let supervisorToken: string;
  let enrollment: any;

  beforeEach(async () => {
    const caseworker = await createTestUser({ login: 'cw', email: 'cw@example.com', role: 'CASEWORKER' });
    const supervisor = await createTestUser({ login: 'sv', email: 'sv@example.com', role: 'SUPERVISOR' });

    caseworkerToken = tokenFor(caseworker);
    supervisorToken = tokenFor(supervisor);

    const program = await createTestProgram({ name: 'Nutrition', kind: 'NUTRITION', subjectType: 'CHILD' });
    const child = await createTestChild({ name: 'Ana' });
    enrollment = await createTestEnrollment(program.id, { childId: child.id });
  });

  const newEvent = (overrides: any = {}) => ({
    name: 'Midwives Day',
    eventDate: '2026-03-01',
    ...overrides,
  });

  describe('auth', () => {
    it('rejects an unauthenticated list', async () => {
      const res = await client.get('/events');
      expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated create', async () => {
      const res = await client.post('/events', newEvent());
      expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated delete', async () => {
      const res = await client.delete('/events/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /events', () => {
    it('creates an event', async () => {
      const res = await client.post('/events', newEvent({ notes: 'At the church' }), caseworkerToken);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        name: 'Midwives Day',
        eventDate: '2026-03-01',
        notes: 'At the church',
        visitCount: 0,
      });
      expect(body).not.toHaveProperty('deletedAt');
    });

    it('normalises a full ISO timestamp to the calendar day', async () => {
      const res = await client.post(
        '/events',
        newEvent({ eventDate: '2026-03-01T23:30:00Z' }),
        caseworkerToken
      );
      expect(res.status).toBe(201);
      expect((await res.json()).eventDate).toBe('2026-03-01');
    });

    it('rejects an empty name', async () => {
      const res = await client.post('/events', newEvent({ name: '' }), caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('rejects a malformed date', async () => {
      const res = await client.post('/events', newEvent({ eventDate: 'March 1st' }), caseworkerToken);
      expect(res.status).toBe(400);
    });

    it('rejects a missing date', async () => {
      const res = await client.post('/events', { name: 'No date' }, caseworkerToken);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /events', () => {
    beforeEach(async () => {
      await client.post('/events', newEvent({ name: 'January', eventDate: '2026-01-10' }), caseworkerToken);
      await client.post('/events', newEvent({ name: 'March', eventDate: '2026-03-10' }), caseworkerToken);
      await client.post('/events', newEvent({ name: 'February', eventDate: '2026-02-10' }), caseworkerToken);
    });

    it('orders by eventDate descending', async () => {
      const res = await client.get('/events', caseworkerToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.skip).toBe(0);
      expect(body.limit).toBe(50);
      expect(body.items.map((e: any) => e.name)).toEqual(['March', 'February', 'January']);
      expect(body.items[0]).not.toHaveProperty('deletedAt');
    });

    it('filters by a from/to date range', async () => {
      const res = await client.get('/events?from=2026-02-01&to=2026-02-28', caseworkerToken);
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('February');
    });

    it('filters by an open-ended from', async () => {
      const res = await client.get('/events?from=2026-02-01', caseworkerToken);
      expect((await res.json()).total).toBe(2);
    });

    it('filters by name', async () => {
      const res = await client.get('/events?search=marc', caseworkerToken);
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('March');
    });

    it('paginates', async () => {
      const res = await client.get('/events?skip=1&limit=1', caseworkerToken);
      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe('February');
    });

    it('rejects a malformed from', async () => {
      const res = await client.get('/events?from=nonsense', caseworkerToken);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /events/:id', () => {
    it('includes a visitCount', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();

      await createTestVisit(enrollment.id, { eventId: created.id });
      await createTestVisit(enrollment.id, { eventId: created.id, visitDate: new Date('2026-03-02') });
      await createTestVisit(enrollment.id, { visitDate: new Date('2026-03-03') });

      const res = await client.get(`/events/${created.id}`, caseworkerToken);
      expect(res.status).toBe(200);
      expect((await res.json()).visitCount).toBe(2);
    });

    it('excludes soft-deleted visits from visitCount', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();
      const visit = await createTestVisit(enrollment.id, { eventId: created.id });
      await testDb.visit.update({ where: { id: visit.id }, data: { deletedAt: new Date() } });

      const res = await client.get(`/events/${created.id}`, caseworkerToken);
      expect((await res.json()).visitCount).toBe(0);
    });

    it('404s for a missing id', async () => {
      const res = await client.get('/events/999999', caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /events/:id', () => {
    it('updates name, date and notes', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();

      const res = await client.put(
        `/events/${created.id}`,
        { name: 'Fathers Day', eventDate: '2026-06-21', notes: 'Rescheduled' },
        caseworkerToken
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('Fathers Day');
      expect(body.eventDate).toBe('2026-06-21');
      expect(body.notes).toBe('Rescheduled');
    });

    it('leaves absent fields alone', async () => {
      const created = await (
        await client.post('/events', newEvent({ notes: 'keep me' }), caseworkerToken)
      ).json();

      const res = await client.put(`/events/${created.id}`, { name: 'Renamed' }, caseworkerToken);
      const body = await res.json();
      expect(body.notes).toBe('keep me');
      expect(body.eventDate).toBe('2026-03-01');
    });

    it('404s for a missing id', async () => {
      const res = await client.put('/events/999999', { name: 'x' }, caseworkerToken);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /events/:id', () => {
    it('rejects a caseworker', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();
      const res = await client.delete(`/events/${created.id}`, caseworkerToken);
      expect(res.status).toBe(403);
    });

    it('soft deletes for a supervisor and hides the row', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();

      const res = await client.delete(`/events/${created.id}`, supervisorToken);
      expect(res.status).toBe(200);

      const row = await testDb.event.findFirst({ where: { id: created.id }, includeDeleted: true });
      expect(row?.deletedAt).not.toBeNull();

      expect((await (await client.get('/events', caseworkerToken)).json()).total).toBe(0);
      expect((await client.get(`/events/${created.id}`, caseworkerToken)).status).toBe(404);
    });

    // onDelete: SetNull never fires because the row is never removed, so the
    // visits attached to a deleted event must stay readable and stay linked.
    it('does not orphan the visits attached to it', async () => {
      const created = await (await client.post('/events', newEvent(), caseworkerToken)).json();
      const visit = await createTestVisit(enrollment.id, { eventId: created.id });

      await client.delete(`/events/${created.id}`, supervisorToken);

      const fetched = await visitClient.get(`/visits/${visit.id}`, caseworkerToken);
      expect(fetched.status).toBe(200);
      expect((await fetched.json()).eventId).toBe(created.id);

      const list = await visitClient.get(`/visits?eventId=${created.id}`, caseworkerToken);
      expect((await list.json()).total).toBe(1);

      const row = await testDb.visit.findUnique({ where: { id: visit.id } });
      expect(row?.eventId).toBe(created.id);
    });

    it('404s for a missing id', async () => {
      const res = await client.delete('/events/999999', supervisorToken);
      expect(res.status).toBe(404);
    });
  });
});
