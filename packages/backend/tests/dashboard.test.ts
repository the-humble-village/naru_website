import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import dashboardRoutes from '../src/routes/dashboard';
import {
  testDb,
  createTestUser,
  createTestFamily,
  createTestChild,
  createTestMother,
  createTestPerson,
  createTestProgram,
  createTestEnrollment,
  createTestVisit,
} from './setup';
import { appConfig } from '../src/config';

// Create test app with dashboard routes and error handler
const app = new Hono();

// Add error handler for HTTPException
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

app.route('/', dashboardRoutes);

// Helper to create JWT tokens
const createTokens = (userId: number, role: string, lang: string = 'en') => {
  const accessToken = jwt.sign(
    { userId, role, lang },
    appConfig.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return accessToken;
};

// Helper to make requests with auth
const testClient = {
  get: async (path: string, accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const request = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers,
    });
    return app.request(request);
  },
};

describe('Dashboard Routes', () => {
  let user: any;
  let accessToken: string;

  beforeEach(async () => {
    user = await createTestUser({ role: 'CASEWORKER' });
    accessToken = createTokens(user.id, user.role);
  });

  describe('GET /dashboard', () => {
    it('should return dashboard data successfully', async () => {
      const family = await createTestFamily({ inCrisis: false });
      const crisisFamily = await createTestFamily({ inCrisis: true });

      const child = await createTestChild({ familyId: family.id });
      await createTestChild({ familyId: crisisFamily.id });

      const program = await createTestProgram();
      const enrollment = await createTestEnrollment(program.id, { childId: child.id });
      await createTestVisit(enrollment.id, { visitDate: new Date() });

      const response = await testClient.get('/', accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('recentVisits');
      expect(data).toHaveProperty('enrollmentsByProgram');
      expect(data).toHaveProperty('familiesInCrisis');
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('visitsPerMonth');
      expect(data).toHaveProperty('newcomersPerMonth');
      expect(data).toHaveProperty('communityBreakdown');

      expect(Array.isArray(data.recentVisits)).toBe(true);
      expect(Array.isArray(data.enrollmentsByProgram)).toBe(true);
      expect(Array.isArray(data.familiesInCrisis)).toBe(true);

      expect(data.familiesInCrisis.length).toBeGreaterThan(0);
      expect(data.familiesInCrisis[0]).toHaveProperty('inCrisis', true);
      expect(data.familiesInCrisis[0]).toHaveProperty('childrenCount');
      expect(data.familiesInCrisis[0]).toHaveProperty('lastVisitDate');

      expect(data.stats).toHaveProperty('activeEnrollments');
      expect(data.stats).toHaveProperty('totalFamilies');
      expect(data.stats).toHaveProperty('totalChildren');
      expect(data.stats).toHaveProperty('totalMothers');
      expect(data.stats).toHaveProperty('totalPeople');
      expect(data.stats).toHaveProperty('totalCommunities');
      expect(data.stats).toHaveProperty('familiesInCrisis');
      expect(data.stats).toHaveProperty('visitsThisMonth');
      expect(data.stats).toHaveProperty('unenrolledSubjects');

      expect(data.stats.totalFamilies).toBe(2);
      expect(data.stats.totalChildren).toBe(2);
      expect(data.stats.familiesInCrisis).toBe(1);
      expect(data.stats.activeEnrollments).toBe(1);
      expect(data.stats.visitsThisMonth).toBe(1);
    });

    it('should return empty arrays when no data exists', async () => {
      const response = await testClient.get('/', accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.recentVisits).toEqual([]);
      expect(data.enrollmentsByProgram).toEqual([]);
      expect(data.familiesInCrisis).toEqual([]);
      expect(data.communityBreakdown).toEqual([]);

      expect(data.stats.totalFamilies).toBe(0);
      expect(data.stats.totalChildren).toBe(0);
      expect(data.stats.familiesInCrisis).toBe(0);
      expect(data.stats.visitsThisMonth).toBe(0);
      expect(data.stats.activeEnrollments).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      const response = await testClient.get('/');
      expect(response.status).toBe(401);
    });

    it('should resolve the subject and program of each recent visit', async () => {
      const child = await createTestChild({ name: 'Visited Child' });
      const program = await createTestProgram({ name: 'Nutrition Infant <6m' });
      const enrollment = await createTestEnrollment(program.id, { childId: child.id });
      await createTestVisit(enrollment.id);

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentVisits).toHaveLength(1);

      const visit = data.recentVisits[0];
      expect(visit.subjectType).toBe('CHILD');
      expect(visit.subjectId).toBe(child.id);
      expect(visit.subjectName).toBe('Visited Child');
      expect(visit.programId).toBe(program.id);
      expect(visit.programName).toBe('Nutrition Infant <6m');
      expect(visit.programKind).toBe('NUTRITION');
    });

    it('should resolve a mother subject as well as a child', async () => {
      const mother = await createTestMother({ name: 'Visited Mother' });
      const program = await createTestProgram({
        name: 'Expectant Mother',
        kind: 'PREGNANCY',
        subjectType: 'MOTHER',
      });
      const enrollment = await createTestEnrollment(program.id, { motherId: mother.id });
      await createTestVisit(enrollment.id);

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      const visit = data.recentVisits[0];
      expect(visit.subjectType).toBe('MOTHER');
      expect(visit.subjectName).toBe('Visited Mother');
    });

    it('should count active enrollments per program and exclude exited ones', async () => {
      const program = await createTestProgram({ name: 'Counted Program' });

      const active = await createTestChild({ name: 'Active Child' });
      const exited = await createTestChild({ name: 'Exited Child' });

      await createTestEnrollment(program.id, { childId: active.id });
      await createTestEnrollment(program.id, { childId: exited.id }, {
        exitedAt: new Date('2026-03-01'),
        exitReason: 'GRADUATED',
      });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      const row = data.enrollmentsByProgram.find((p: any) => p.programId === program.id);
      expect(row.active).toBe(1);
      expect(data.stats.activeEnrollments).toBe(1);
    });

    it('should count subjects with no active enrollment', async () => {
      await createTestChild({ name: 'Unenrolled Child' });
      await createTestMother({ name: 'Unenrolled Mother' });

      const enrolled = await createTestChild({ name: 'Enrolled Child' });
      const program = await createTestProgram();
      await createTestEnrollment(program.id, { childId: enrolled.id });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.stats.unenrolledSubjects).toBe(2);
    });

    it('should report newcomers in the month they enrolled', async () => {
      const child = await createTestChild();
      const program = await createTestProgram();
      await createTestEnrollment(program.id, { childId: child.id }, { enrolledAt: new Date() });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.newcomersPerMonth).toHaveLength(6);
      expect(data.newcomersPerMonth[5]!.count).toBe(1);
    });

    it('should break down families and enrollments by community', async () => {
      const community = await testDb.community.create({ data: { title: 'Breakdown Community' } });
      const family = await createTestFamily({ communityId: community.id });
      await createTestChild({ familyId: family.id });

      const program = await createTestProgram({ kind: 'FAMILY_PAF', subjectType: 'FAMILY' });
      await createTestEnrollment(program.id, { familyId: family.id });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      const row = data.communityBreakdown.find((c: any) => c.communityId === community.id);
      expect(row.families).toBe(1);
      expect(row.children).toBe(1);
      expect(row.activeEnrollments).toBe(1);
    });

    it('should format visit dates as date-only strings', async () => {
      const child = await createTestChild();
      const program = await createTestProgram();
      const enrollment = await createTestEnrollment(program.id, { childId: child.id });
      await createTestVisit(enrollment.id, { visitDate: new Date('2026-02-15') });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      expect(data.recentVisits[0]!.visitDate).toBe('2026-02-15');
    });

    it('should properly format all datetime fields as ISO strings', async () => {
      const family = await createTestFamily({ inCrisis: true });

      const response = await testClient.get('/', accessToken);
      const data = await response.json();

      const crisis = data.familiesInCrisis[0];
      expect(crisis.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(crisis.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(crisis.deletedAt).toBeUndefined();
    });
  });

  describe('GET /unenrolled-count', () => {
    it('should require authentication', async () => {
      const response = await testClient.get('/unenrolled-count');
      expect(response.status).toBe(401);
    });

    it('should return zeroes when there are no subjects', async () => {
      const response = await testClient.get('/unenrolled-count', accessToken);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ children: 0, mothers: 0, people: 0, families: 0, total: 0 });
    });

    it('should exclude a subject holding an active enrollment', async () => {
      const program = await createTestProgram();
      const enrolled = await createTestChild({ name: 'Enrolled' });
      await createTestChild({ name: 'Not enrolled' });
      await createTestEnrollment(program.id, { childId: enrolled.id });

      const response = await testClient.get('/unenrolled-count', accessToken);
      const data = await response.json();

      expect(data.children).toBe(1);
      expect(data.total).toBe(1);
    });

    it('should count a subject whose only enrollment has been exited', async () => {
      const program = await createTestProgram();
      const child = await createTestChild();
      await createTestEnrollment(
        program.id,
        { childId: child.id },
        { exitedAt: new Date('2026-06-01'), exitReason: 'GRADUATED' }
      );

      const response = await testClient.get('/unenrolled-count', accessToken);
      const data = await response.json();

      expect(data.children).toBe(1);
      expect(data.total).toBe(1);
    });

    it('should break the total down across all four subject tables', async () => {
      await createTestChild();
      await createTestMother();
      await createTestPerson();
      await createTestFamily();

      const response = await testClient.get('/unenrolled-count', accessToken);
      const data = await response.json();

      expect(data).toMatchObject({ children: 1, mothers: 1, people: 1, families: 1, total: 4 });
    });

    it('should agree with the dashboard stats', async () => {
      await createTestChild();
      await createTestMother();

      const [countsResponse, dashboardResponse] = await Promise.all([
        testClient.get('/unenrolled-count', accessToken),
        testClient.get('/', accessToken),
      ]);

      const counts = await countsResponse.json();
      const dashboard = await dashboardResponse.json();

      expect(dashboard.stats.unenrolledSubjects).toBe(counts.total);
    });
  });
});
