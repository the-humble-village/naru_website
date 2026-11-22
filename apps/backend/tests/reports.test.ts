import { describe, it, expect, beforeEach } from 'vitest';
import reportRoutes from '../src/routes/reports';
import { mountRoutes, tokenFor } from './http';
import {
  testDb,
  createTestUser,
  createTestProgram,
  createTestEnrollment,
  createTestVisit,
  createTestChild,
  createTestMother,
  createTestCommunity,
} from './setup';

const client = mountRoutes('/reports', reportRoutes);

type Row = Record<string, string | number | boolean | null>;

interface ReportBody {
  slug: string;
  title: string;
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Row[];
  total: number;
}

let token: string;

let siteA: { id: number };
let siteB: { id: number };
let commA: { id: number };
let commB: { id: number };
let nutrition: { id: number };
let pregnancy: { id: number };
let child1: { id: number };
let child2: { id: number };
let child3: { id: number };
let mother1: { id: number };
let enr1: { id: number };
let enr2: { id: number };
let enr3: { id: number };
let enr4: { id: number };
let chickens: { id: number };
let homeVisit: { id: number };
let betaVisit1: { id: number };

const get = async (path: string): Promise<ReportBody> => {
  const response = await client.get(path, token);
  expect(response.status).toBe(200);
  return (await response.json()) as ReportBody;
};

const find = (body: ReportBody, match: Partial<Row>): Row | undefined =>
  body.rows.find((row) => Object.entries(match).every(([key, value]) => row[key] === value));

beforeEach(async () => {
  const user = await createTestUser({ login: 'reporter', role: 'CASEWORKER' });
  token = tokenFor(user);

  siteA = await testDb.site.create({ data: { title: 'Alpha Site' } });
  siteB = await testDb.site.create({ data: { title: 'Beta Site' } });
  commA = await createTestCommunity({ title: 'Community A', siteId: siteA.id });
  commB = await createTestCommunity({ title: 'Community B', siteId: siteB.id });

  nutrition = await createTestProgram({ name: 'Nutrition Program' });
  pregnancy = await createTestProgram({
    name: 'Pregnancy Program',
    kind: 'PREGNANCY',
    subjectType: 'MOTHER',
  });

  child1 = await createTestChild({
    name: 'Ana Lopez',
    birthDate: new Date('2025-06-01'),
    communityId: commA.id,
  });
  child2 = await createTestChild({
    name: 'Beto Cruz',
    birthDate: new Date('2025-05-01'),
    communityId: commA.id,
  });
  child3 = await createTestChild({
    name: 'Cruz, "Tito"',
    birthDate: new Date('2022-01-01'),
    communityId: commB.id,
  });
  mother1 = await createTestMother({
    name: 'Maria Solis',
    birthDate: new Date('1995-03-01'),
    communityId: commA.id,
  });

  await testDb.child.update({ where: { id: child2.id }, data: { motherId: mother1.id } });

  enr1 = await createTestEnrollment(nutrition.id, { childId: child1.id }, {
    enrolledAt: new Date('2026-01-10'),
    entryWeight: 5.5,
  });
  enr2 = await createTestEnrollment(nutrition.id, { childId: child2.id }, {
    enrolledAt: new Date('2026-02-05'),
    entryWeight: 6,
    exitedAt: new Date('2026-05-01'),
    exitReason: 'GRADUATED',
    exitWeight: 8.5,
  });
  enr3 = await createTestEnrollment(nutrition.id, { childId: child3.id }, {
    enrolledAt: new Date('2026-03-20'),
    entryWeight: 4,
  });
  enr4 = await createTestEnrollment(pregnancy.id, { motherId: mother1.id }, {
    enrolledAt: new Date('2026-01-15'),
  });

  // enr1: four visits at Alpha, statuses SEVERE → MODERATE → MODERATE → MILD.
  const statuses = ['SEVERE', 'MODERATE', 'MODERATE', 'MILD'] as const;
  const dates = ['2026-01-20', '2026-02-20', '2026-03-20', '2026-04-20'];

  for (let i = 0; i < statuses.length; i += 1) {
    const visit = await createTestVisit(enr1.id, {
      visitDate: new Date(dates[i]!),
      siteId: siteA.id,
      communityId: commA.id,
      locationType: i === 3 ? 'HOME' : 'SITE',
    });
    await testDb.nutritionVisitDetail.create({
      data: { visitId: visit.id, nutritionalStatus: statuses[i]! },
    });
    if (i === 3) homeVisit = visit;
  }

  // enr3: two visits at Beta, both SEVERE — no transition.
  for (const visitDate of ['2026-03-25', '2026-04-25']) {
    const visit = await createTestVisit(enr3.id, {
      visitDate: new Date(visitDate),
      siteId: siteB.id,
      communityId: commB.id,
    });
    await testDb.nutritionVisitDetail.create({
      data: { visitId: visit.id, nutritionalStatus: 'SEVERE' },
    });
    if (visitDate === '2026-03-25') betaVisit1 = visit;
  }

  // enr2: one mobile-clinic visit recorded at Beta even though the child lives
  // in Community A — the visit site is authoritative.
  const mobileVisit = await createTestVisit(enr2.id, {
    visitDate: new Date('2026-03-01'),
    siteId: siteB.id,
    locationType: 'MOBILE_CLINIC',
  });
  await testDb.nutritionVisitDetail.create({
    data: { visitId: mobileVisit.id, nutritionalStatus: 'NORMAL' },
  });

  chickens = await testDb.resource.create({ data: { title: 'Chickens', defaultUnit: 'bird' } });

  const firstAlphaVisit = await testDb.visit.findFirst({
    where: { enrollmentId: enr1.id },
    orderBy: { visitDate: 'asc' },
  });

  await testDb.visitResource.create({
    data: { visitId: firstAlphaVisit!.id, resourceId: chickens.id, quantity: 3 },
  });
  await testDb.visitResource.create({
    data: { visitId: betaVisit1.id, resourceId: chickens.id, quantity: 2, unit: 'bird' },
  });
});

describe('GET /reports (index)', () => {
  it('requires authentication', async () => {
    const response = await client.get('/reports');
    expect(response.status).toBe(401);
  });

  it('lists the twelve reports plus the deferred one', async () => {
    const body = (await (await client.get('/reports', token)).json()) as {
      items: Array<{ slug: string; available: boolean; note: string | null; chart: string | null }>;
      total: number;
    };

    expect(body.total).toBe(13);
    expect(body.items.filter((item) => item.available)).toHaveLength(12);

    const deferred = body.items.find((item) => item.slug === 'mobile-clinics');
    expect(deferred).toBeDefined();
    expect(deferred!.available).toBe(false);
    expect(deferred!.note).toMatch(/not available in v1/i);

    expect(body.items.find((item) => item.slug === 'newcomers')!.chart).toBe('line');
    expect(body.items.find((item) => item.slug === 'transitions')!.chart).toBe('bar');
  });
});

describe('GET /reports/:slug — errors', () => {
  it('requires authentication', async () => {
    const response = await client.get('/reports/census');
    expect(response.status).toBe(401);
  });

  it('404s on an unknown slug', async () => {
    const response = await client.get('/reports/not-a-report', token);
    expect(response.status).toBe(404);
  });

  it('refuses the deferred report with an explanation', async () => {
    const response = await client.get('/reports/mobile-clinics', token);
    expect(response.status).toBe(501);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/not available in V1/);
  });

  it('rejects a malformed date filter', async () => {
    const response = await client.get('/reports/census?from=yesterday', token);
    expect(response.status).toBe(400);
  });
});

describe('census', () => {
  it('counts enrollments open on the given date, by program and site', async () => {
    const body = await get('/reports/census?asOf=2026-04-01');

    expect(body.slug).toBe('census');
    expect(body.total).toBe(3);
    expect(find(body, { programName: 'Nutrition Program', siteName: 'Alpha Site' })!.enrolled).toBe(2);
    expect(find(body, { programName: 'Nutrition Program', siteName: 'Beta Site' })!.enrolled).toBe(1);
    expect(find(body, { programName: 'Pregnancy Program', siteName: 'Alpha Site' })!.enrolled).toBe(1);
  });

  it('drops an enrollment that had already exited', async () => {
    const body = await get('/reports/census?asOf=2026-06-01');

    expect(find(body, { programName: 'Nutrition Program', siteName: 'Alpha Site' })!.enrolled).toBe(1);
  });

  it('counts nobody before the first admission', async () => {
    const body = await get('/reports/census?asOf=2025-12-31');
    expect(body.total).toBe(0);
  });

  it('narrows to a single site', async () => {
    const body = await get(`/reports/census?asOf=2026-04-01&siteId=${siteB.id}`);

    expect(body.total).toBe(1);
    expect(body.rows[0]!.siteName).toBe('Beta Site');
    expect(body.rows[0]!.enrolled).toBe(1);
  });

  it('narrows to a single program', async () => {
    const body = await get(`/reports/census?asOf=2026-04-01&programId=${pregnancy.id}`);

    expect(body.total).toBe(1);
    expect(body.rows[0]!.programName).toBe('Pregnancy Program');
  });

  it('excludes a soft-deleted subject', async () => {
    await testDb.child.update({ where: { id: child3.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/census?asOf=2026-04-01');
    expect(find(body, { siteName: 'Beta Site' })).toBeUndefined();
    expect(body.total).toBe(2);
  });

  it('excludes a soft-deleted enrollment', async () => {
    await testDb.enrollment.update({ where: { id: enr4.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/census?asOf=2026-04-01');
    expect(find(body, { programName: 'Pregnancy Program' })).toBeUndefined();
  });
});

describe('weight-change', () => {
  it('pairs entry and exit weight per enrollment', async () => {
    const body = await get('/reports/weight-change');

    expect(body.total).toBe(3);

    const graduate = find(body, { enrollmentId: enr2.id })!;
    expect(graduate.entryWeight).toBe(6);
    expect(graduate.exitWeight).toBe(8.5);
    expect(graduate.weightChange).toBe(2.5);
    expect(graduate.exitedAt).toBe('2026-05-01');

    const stillIn = find(body, { enrollmentId: enr1.id })!;
    expect(stillIn.exitWeight).toBeNull();
    expect(stillIn.weightChange).toBeNull();
    expect(stillIn.subjectName).toBe('Ana Lopez');

    // The pregnancy enrollment carries no weights at all.
    expect(find(body, { enrollmentId: enr4.id })).toBeUndefined();
  });

  it('narrows by admission date range', async () => {
    const body = await get('/reports/weight-change?from=2026-02-01&to=2026-02-28');

    expect(body.total).toBe(1);
    expect(body.rows[0]!.enrollmentId).toBe(enr2.id);
  });
});

describe('graduations', () => {
  it('returns only graduated enrollments with age and weight at exit', async () => {
    const body = await get('/reports/graduations');

    expect(body.total).toBe(1);

    const row = body.rows[0]!;
    expect(row.enrollmentId).toBe(enr2.id);
    expect(row.exitedAt).toBe('2026-05-01');
    expect(row.ageMonthsAtExit).toBe(12);
    expect(row.weightChange).toBe(2.5);
  });

  it('ignores a non-graduating exit', async () => {
    await testDb.enrollment.update({
      where: { id: enr2.id },
      data: { exitReason: 'MOVED_AWAY' },
    });

    const body = await get('/reports/graduations');
    expect(body.total).toBe(0);
  });

  it('narrows by exit date range', async () => {
    const body = await get('/reports/graduations?from=2026-01-01&to=2026-04-30');
    expect(body.total).toBe(0);
  });
});

describe('transitions', () => {
  it('counts each consecutive status change, not first-vs-last', async () => {
    const body = await get('/reports/transitions');

    expect(body.total).toBe(2);

    expect(
      find(body, { siteName: 'Alpha Site', fromStatus: 'SEVERE', toStatus: 'MODERATE' })!.transitions
    ).toBe(1);
    expect(
      find(body, { siteName: 'Alpha Site', fromStatus: 'MODERATE', toStatus: 'MILD' })!.transitions
    ).toBe(1);

    // Beta's two visits are both SEVERE — no transition, so no row.
    expect(find(body, { siteName: 'Beta Site' })).toBeUndefined();
  });

  it('counts a relapse as its own transition', async () => {
    const visit = await createTestVisit(enr1.id, {
      visitDate: new Date('2026-05-20'),
      siteId: siteA.id,
      communityId: commA.id,
    });
    await testDb.nutritionVisitDetail.create({
      data: { visitId: visit.id, nutritionalStatus: 'SEVERE' },
    });

    const body = await get('/reports/transitions');
    expect(find(body, { fromStatus: 'MILD', toStatus: 'SEVERE' })!.transitions).toBe(1);
  });

  it('excludes a soft-deleted visit', async () => {
    await testDb.visit.update({ where: { id: homeVisit.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/transitions');
    expect(body.total).toBe(1);
    expect(find(body, { fromStatus: 'MODERATE', toStatus: 'MILD' })).toBeUndefined();
  });
});

describe('newcomers', () => {
  it('groups admissions by month and site', async () => {
    const body = await get('/reports/newcomers');

    expect(find(body, { month: '2026-01', siteName: 'Alpha Site' })!.newcomers).toBe(2);
    expect(find(body, { month: '2026-02', siteName: 'Alpha Site' })!.newcomers).toBe(1);
    expect(find(body, { month: '2026-03', siteName: 'Beta Site' })!.newcomers).toBe(1);
    expect(body.total).toBe(3);
  });

  it('narrows by date range', async () => {
    const body = await get('/reports/newcomers?from=2026-02-01');

    expect(body.total).toBe(2);
    expect(find(body, { month: '2026-01' })).toBeUndefined();
  });
});

describe('attendance', () => {
  it('counts visits where they happened, not where the subject lives', async () => {
    const body = await get('/reports/attendance');

    expect(body.total).toBe(2);

    const alpha = find(body, { siteName: 'Alpha Site' })!;
    expect(alpha.programName).toBe('Nutrition Program');
    expect(alpha.visits).toBe(4);
    expect(alpha.subjects).toBe(1);

    // enr2's mobile clinic was recorded at Beta even though child2 lives in Community A.
    const beta = find(body, { siteName: 'Beta Site' })!;
    expect(beta.visits).toBe(3);
    expect(beta.subjects).toBe(2);
  });

  it('narrows by visit site', async () => {
    const body = await get(`/reports/attendance?siteId=${siteA.id}`);

    expect(body.total).toBe(1);
    expect(body.rows[0]!.visits).toBe(4);
  });
});

describe('visits-by-site', () => {
  it('totals visits per site', async () => {
    const body = await get('/reports/visits-by-site');

    expect(find(body, { siteName: 'Alpha Site' })!.visits).toBe(4);
    expect(find(body, { siteName: 'Beta Site' })!.visits).toBe(3);
  });

  it('excludes a soft-deleted visit', async () => {
    await testDb.visit.update({ where: { id: homeVisit.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/visits-by-site');
    expect(find(body, { siteName: 'Alpha Site' })!.visits).toBe(3);
  });

  it('excludes visits on a soft-deleted enrollment', async () => {
    await testDb.enrollment.update({ where: { id: enr3.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/visits-by-site');
    expect(find(body, { siteName: 'Beta Site' })!.visits).toBe(1);
  });

  it('narrows by date range', async () => {
    const body = await get('/reports/visits-by-site?from=2026-04-01&to=2026-04-30');

    expect(body.total).toBe(2);
    expect(find(body, { siteName: 'Alpha Site' })!.visits).toBe(1);
    expect(find(body, { siteName: 'Beta Site' })!.visits).toBe(1);
  });
});

describe('evaluations', () => {
  it('breaks nutritional evaluations down by status per site', async () => {
    const body = await get('/reports/evaluations');

    const alpha = find(body, { siteName: 'Alpha Site' })!;
    expect(alpha.evaluations).toBe(4);
    expect(alpha.severe).toBe(1);
    expect(alpha.moderate).toBe(2);
    expect(alpha.mild).toBe(1);
    expect(alpha.normal).toBe(0);

    const beta = find(body, { siteName: 'Beta Site' })!;
    expect(beta.evaluations).toBe(3);
    expect(beta.severe).toBe(2);
    expect(beta.normal).toBe(1);
  });
});

describe('home-visits', () => {
  it('counts only visits recorded in the home', async () => {
    const body = await get('/reports/home-visits');

    expect(body.total).toBe(1);
    expect(body.rows[0]!.siteName).toBe('Alpha Site');
    expect(body.rows[0]!.homeVisits).toBe(1);
    expect(body.rows[0]!.subjects).toBe(1);
  });
});

describe('resources', () => {
  it('sums quantity handed out per resource and site', async () => {
    const body = await get('/reports/resources');

    expect(body.total).toBe(2);

    const alpha = find(body, { siteName: 'Alpha Site' })!;
    expect(alpha.resourceTitle).toBe('Chickens');
    expect(alpha.unit).toBe('bird');
    expect(alpha.totalQuantity).toBe(3);
    expect(alpha.visits).toBe(1);

    expect(find(body, { siteName: 'Beta Site' })!.totalQuantity).toBe(2);
  });

  it('adds up repeat distributions at the same site', async () => {
    const visit = await testDb.visit.findFirst({
      where: { enrollmentId: enr1.id },
      orderBy: { visitDate: 'desc' },
    });
    await testDb.visitResource.create({
      data: { visitId: visit!.id, resourceId: chickens.id, quantity: 4, unit: 'bird' },
    });

    const body = await get('/reports/resources');
    expect(find(body, { siteName: 'Alpha Site' })!.totalQuantity).toBe(7);
    expect(find(body, { siteName: 'Alpha Site' })!.visits).toBe(2);
  });
});

describe('demographics', () => {
  it('bands enrolled subjects by community and age', async () => {
    const body = await get('/reports/demographics?to=2026-04-01');

    const a = find(body, { communityName: 'Community A' })!;
    expect(a.siteName).toBe('Alpha Site');
    expect(a.members).toBe(3);
    expect(a.under1).toBe(2);
    expect(a.age1to4).toBe(0);
    expect(a.age15plus).toBe(1);
    expect(a.ageUnknown).toBe(0);

    const b = find(body, { communityName: 'Community B' })!;
    expect(b.members).toBe(1);
    expect(b.age1to4).toBe(1);
  });

  it('counts a subject in two programs once', async () => {
    const second = await createTestProgram({ name: 'Second Nutrition Program' });
    await createTestEnrollment(second.id, { childId: child1.id }, {
      enrolledAt: new Date('2026-02-01'),
    });

    const body = await get('/reports/demographics?to=2026-04-01');
    expect(find(body, { communityName: 'Community A' })!.members).toBe(3);
  });

  it('reports an unknown birth date rather than dropping the subject', async () => {
    await testDb.mother.update({ where: { id: mother1.id }, data: { birthDate: null } });

    const body = await get('/reports/demographics?to=2026-04-01');
    const a = find(body, { communityName: 'Community A' })!;
    expect(a.members).toBe(3);
    expect(a.ageUnknown).toBe(1);
    expect(a.age15plus).toBe(0);
  });
});

describe('incap-pairs', () => {
  it('links an enrolled child to its enrolled mother', async () => {
    const body = await get('/reports/incap-pairs');

    expect(body.total).toBe(1);

    const row = body.rows[0]!;
    expect(row.motherId).toBe(mother1.id);
    expect(row.motherProgram).toBe('Pregnancy Program');
    expect(row.childId).toBe(child2.id);
    expect(row.childProgram).toBe('Nutrition Program');
    expect(row.childBirthDate).toBe('2025-05-01');
    expect(row.communityName).toBe('Community A');
    expect(row.siteName).toBe('Alpha Site');
    expect(row.childEntryWeight).toBe(6);
    expect(row.latestStatus).toBe('NORMAL');
  });

  it('drops the pair when the mother has no enrollment', async () => {
    await testDb.enrollment.update({ where: { id: enr4.id }, data: { deletedAt: new Date() } });

    const body = await get('/reports/incap-pairs');
    expect(body.total).toBe(0);
  });

  it('narrows by the child site', async () => {
    const body = await get(`/reports/incap-pairs?siteId=${siteB.id}`);
    expect(body.total).toBe(0);
  });
});

describe('CSV export', () => {
  it('serves a downloadable CSV built from the same rows as the table', async () => {
    const response = await client.get('/reports/census?asOf=2026-04-01', token);
    const table = (await response.json()) as ReportBody;

    const csvResponse = await client.get('/reports/census/export?asOf=2026-04-01', token);
    expect(csvResponse.status).toBe(200);
    expect(csvResponse.headers.get('content-type')).toContain('text/csv');
    expect(csvResponse.headers.get('content-disposition')).toMatch(
      /^attachment; filename="census-\d{4}-\d{2}-\d{2}\.csv"$/
    );

    const lines = (await csvResponse.text()).split('\r\n');
    expect(lines[0]).toBe('Program,Kind,Site,Enrolled');
    expect(lines).toHaveLength(table.rows.length + 1);
    expect(lines[1]).toBe('Nutrition Program,NUTRITION,Alpha Site,2');
  });

  it('escapes commas and quotes, and blanks nulls', async () => {
    const csv = await (await client.get('/reports/weight-change/export', token)).text();
    const lines = csv.split('\r\n');

    // enr3 is the most recent admission and its subject name contains both a
    // comma and a double quote.
    expect(lines[1]).toBe('"Cruz, ""Tito""",Nutrition Program,Beta Site,2026-03-20,,4,,');
  });

  it('requires authentication', async () => {
    const response = await client.get('/reports/census/export');
    expect(response.status).toBe(401);
  });

  it('404s on an unknown slug', async () => {
    const response = await client.get('/reports/nope/export', token);
    expect(response.status).toBe(404);
  });
});
