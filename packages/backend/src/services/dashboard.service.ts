import { type DashboardResponse, type UserRead } from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly } from '../utils/date.js';

const ACTIVE = { exitedAt: null, deletedAt: null } as const;

// An enrollment names exactly one subject, so whichever relation came back
// non-null is the one to read the display name from.
function subjectOf(enrollment: any): { type: 'MOTHER' | 'CHILD' | 'PERSON' | 'FAMILY'; id: number; name: string | null } {
  if (enrollment.mother) return { type: 'MOTHER', id: enrollment.mother.id, name: enrollment.mother.name };
  if (enrollment.child) return { type: 'CHILD', id: enrollment.child.id, name: enrollment.child.name };
  if (enrollment.person) return { type: 'PERSON', id: enrollment.person.id, name: enrollment.person.name };
  return { type: 'FAMILY', id: enrollment.family.id, name: enrollment.family.familyName };
}

export interface UnenrolledCount {
  children: number;
  mothers: number;
  people: number;
  families: number;
  total: number;
}

/**
 * Count subjects holding no active enrollment. Split out of getDashboardData so
 * the sidebar badge, which renders on every page, does not pay for the whole
 * dashboard payload.
 */
export async function getUnenrolledCount(): Promise<UnenrolledCount> {
  const noActiveEnrollment = { enrollments: { none: ACTIVE } };

  const [children, mothers, people, families] = await Promise.all([
    prisma.child.count({ where: noActiveEnrollment }),
    prisma.mother.count({ where: noActiveEnrollment }),
    prisma.person.count({ where: noActiveEnrollment }),
    prisma.family.count({ where: noActiveEnrollment }),
  ]);

  return { children, mothers, people, families, total: children + mothers + people + families };
}

/**
 * Get dashboard data: the active-enrollment census, recent visits, families in
 * crisis, and six-month visit and newcomer trends.
 */
export async function getDashboardData(user: UserRead): Promise<DashboardResponse> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const SIX_MONTHS = 6;
  const monthSlots = Array.from({ length: SIX_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (SIX_MONTHS - 1 - i), 1);
    return {
      label: d.toLocaleString('en-US', { month: 'short' }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  });

  // TODO: When we implement user assignment/scoping, add access control here.

  const [
    recentVisitRows,
    programs,
    familiesInCrisisRows,
    familiesWithCounts,
    activeEnrollments,
    totalChildren,
    totalMothers,
    totalPeople,
    totalFamilies,
    totalCommunities,
    visitsThisMonth,
  ] = await Promise.all([
    prisma.visit.findMany({
      take: 10,
      orderBy: { visitDate: 'desc' },
      select: {
        id: true,
        enrollmentId: true,
        visitDate: true,
        locationType: true,
        siteId: true,
        enrollment: {
          select: {
            program: { select: { id: true, name: true, kind: true } },
            mother: { select: { id: true, name: true } },
            child: { select: { id: true, name: true } },
            person: { select: { id: true, name: true } },
            family: { select: { id: true, familyName: true } },
          },
        },
      },
    }),
    prisma.program.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        kind: true,
        _count: { select: { enrollments: { where: ACTIVE } } },
      },
    }),
    prisma.family.findMany({
      where: { inCrisis: true },
      select: {
        id: true,
        localId: true,
        familyName: true,
        communityId: true,
        phone: true,
        caretaker2Name: true,
        incomeSources: true,
        deathsNotes: true,
        inCrisis: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: true } },
        enrollments: {
          select: {
            visits: { take: 1, orderBy: { visitDate: 'desc' }, select: { visitDate: true } },
          },
        },
      },
    }),
    prisma.family.findMany({
      select: {
        communityId: true,
        _count: {
          select: {
            children: true,
            enrollments: { where: ACTIVE },
          },
        },
      },
    }),
    prisma.enrollment.count({ where: ACTIVE }),
    prisma.child.count(),
    prisma.mother.count(),
    prisma.person.count(),
    prisma.family.count(),
    prisma.community.count(),
    prisma.visit.count({ where: { visitDate: { gte: startOfMonth }, deletedAt: null } }),
  ]);

  // Subjects with no active enrollment — the §9.4 worklist.
  const unenrolled = await getUnenrolledCount();

  const trends = await Promise.all(
    monthSlots.map(async ({ label, start, end }) => {
      const [visits, newcomers] = await Promise.all([
        prisma.visit.count({ where: { visitDate: { gte: start, lt: end }, deletedAt: null } }),
        prisma.enrollment.count({ where: { enrolledAt: { gte: start, lt: end }, deletedAt: null } }),
      ]);
      return { month: label, visits, newcomers };
    })
  );

  const communityMap = new Map<number | null, { families: number; children: number; activeEnrollments: number }>();
  for (const family of familiesWithCounts) {
    const existing = communityMap.get(family.communityId) ?? { families: 0, children: 0, activeEnrollments: 0 };
    existing.families += 1;
    existing.children += family._count.children;
    existing.activeEnrollments += family._count.enrollments;
    communityMap.set(family.communityId, existing);
  }

  return {
    recentVisits: recentVisitRows.map((visit: any) => {
      const subject = subjectOf(visit.enrollment);
      return {
        id: visit.id,
        enrollmentId: visit.enrollmentId,
        visitDate: toDateOnly(visit.visitDate)!,
        locationType: visit.locationType,
        siteId: visit.siteId,
        programId: visit.enrollment.program.id,
        programName: visit.enrollment.program.name,
        programKind: visit.enrollment.program.kind,
        subjectType: subject.type,
        subjectId: subject.id,
        subjectName: subject.name,
      };
    }),

    enrollmentsByProgram: programs.map((program: any) => ({
      programId: program.id,
      programName: program.name,
      programKind: program.kind,
      active: program._count.enrollments,
    })),

    familiesInCrisis: familiesInCrisisRows.map(({ _count, enrollments, ...family }: any) => {
      const visitDates: Date[] = enrollments.flatMap((e: any) => e.visits).map((v: any) => v.visitDate);
      const lastVisit = visitDates.length ? visitDates.reduce((a, b) => (a > b ? a : b)) : null;

      return {
        ...family,
        createdAt: family.createdAt.toISOString(),
        updatedAt: family.updatedAt.toISOString(),
        childrenCount: _count.children,
        lastVisitDate: toDateOnly(lastVisit),
      };
    }),

    stats: {
      activeEnrollments,
      totalChildren,
      totalMothers,
      totalPeople,
      totalFamilies,
      totalCommunities,
      familiesInCrisis: familiesInCrisisRows.length,
      visitsThisMonth,
      unenrolledSubjects: unenrolled.total,
    },

    visitsPerMonth: trends.map(({ month, visits }) => ({ month, count: visits })),
    newcomersPerMonth: trends.map(({ month, newcomers }) => ({ month, count: newcomers })),

    communityBreakdown: Array.from(communityMap.entries()).map(([communityId, counts]) => ({
      communityId,
      ...counts,
    })),
  };
}
