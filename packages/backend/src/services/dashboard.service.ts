import {
  type DashboardResponse,
  type UserRead,
  type ChildVisitQuestion,
  type FamilyVisitQuestion,
  type TrainingReceived,
  type ResourceReceived,
} from '@naru/shared';
import prisma from '../db.js';

/**
 * Get dashboard data with recent visits, recently updated children, families in crisis, and summary stats
 */
export async function getDashboardData(user: UserRead): Promise<DashboardResponse> {
  // Calculate start of current month for stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build a 6-month window (oldest first) for the line chart
  const SIX_MONTHS = 6;
  const monthSlots = Array.from({ length: SIX_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (SIX_MONTHS - 1 - i), 1);
    return {
      label: d.toLocaleString('en-US', { month: 'short' }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  });

  // TODO: When we implement user assignment/scoping, add access control for caseworkers
  const familyFilter = {}; // For now, show all data to all users

  // Get recent child visits (last 10)
  const recentChildVisits = await prisma.childVisit.findMany({
    where: {
      child: {
        family: familyFilter
      }
    },
    take: 10,
    orderBy: {
      visitDate: 'desc',
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      childId: true,
      visitDate: true,
      weight: true,
      armCircumference: true,
      height: true,
      incap: true,
      leche: true,
      bagsGiven: true,
      recvAnyMedicine: true,
      leftFromProg: true,
      passedAway: true,
      questions: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      child: {
        select: {
          id: true,
          name: true,
          familyId: true,
        },
      },
    },
  });

  // Get recent family visits (last 10)
  const recentFamilyVisits = await prisma.familyVisit.findMany({
    where: {
      family: familyFilter
    },
    take: 10,
    orderBy: {
      visitDate: 'desc',
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      visitDate: true,
      trainingsReceived: true,
      resourcesReceived: true,
      questions: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      family: {
        select: {
          id: true,
          familyName: true,
        },
      },
    },
  });

  // Get recently updated children (last 10, with latest visit info)
  const recentlyUpdatedChildren = await prisma.child.findMany({
    where: {
      family: familyFilter
    },
    take: 10,
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      name: true,
      birthDate: true,
      sex: true,
      dateEntered: true,
      photos: true,
      weight: true,
      nutritionalState: true,
      reasonEnrollment: true,
      observations: true,
      createdAt: true,
      updatedAt: true,
      family: {
        select: {
          id: true,
          familyName: true,
        },
      },
      childVisits: {
        take: 1,
        orderBy: {
          visitDate: 'desc',
        },
        select: {
          id: true,
          visitDate: true,
          weight: true,
          height: true,
          armCircumference: true,
        },
      },
    },
  });

  // Get families in crisis with child count and last visit date
  const familiesInCrisis = await prisma.family.findMany({
    where: {
      ...familyFilter,
      inCrisis: true,
    },
    select: {
      id: true,
      localId: true,
      familyName: true,
      childrenEditable: true,
      inCrisis: true,
      notes: true,
      communityId: true,
      siteId: true,
      birthingAssistantId: true,
      createdAt: true,
      updatedAt: true,
      children: {
        select: {
          id: true,
        },
      },
      familyVisits: {
        take: 1,
        orderBy: {
          visitDate: 'desc',
        },
        select: {
          visitDate: true,
        },
      },
    },
  });

  // Get community breakdown (families + children per community)
  const familiesWithChildCount = await prisma.family.findMany({
    where: familyFilter,
    select: {
      communityId: true,
      _count: { select: { children: true } },
    },
  });
  const communityMap = new Map<number | null, { families: number; children: number }>();
  for (const f of familiesWithChildCount) {
    const key = f.communityId;
    const existing = communityMap.get(key) ?? { families: 0, children: 0 };
    existing.families += 1;
    existing.children += f._count.children;
    communityMap.set(key, existing);
  }
  const communityBreakdown = Array.from(communityMap.entries()).map(([communityId, counts]) => ({
    communityId,
    ...counts,
  }));

  // Get summary statistics (crisis count derived from already-fetched familiesInCrisis)
  const [totalFamilies, totalChildren, visitsThisMonth] = await Promise.all([
    prisma.family.count({
      where: familyFilter,
    }),
    prisma.child.count({
      where: {
        family: familyFilter,
      },
    }),
    Promise.all([
      prisma.childVisit.count({
        where: {
          visitDate: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      prisma.familyVisit.count({
        where: {
          visitDate: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
    ]).then(([childVisits, familyVisits]) => childVisits + familyVisits),
  ]);
  const familiesInCrisisCount = familiesInCrisis.length;

  // Count visits per month for the last 6 months
  const visitsPerMonth = await Promise.all(
    monthSlots.map(async ({ label, start, end }) => {
      const [child, family] = await Promise.all([
        prisma.childVisit.count({
          where: { visitDate: { gte: start, lt: end }, deletedAt: null },
        }),
        prisma.familyVisit.count({
          where: { visitDate: { gte: start, lt: end }, deletedAt: null },
        }),
      ]);
      return { month: label, count: child + family };
    })
  );

  // Transform the data to match the expected schema format
  const dashboardData: DashboardResponse = {
    recentVisits: {
      childVisits: recentChildVisits.map((visit: any) => ({
        id: visit.id,
        localId: visit.localId,
        familyId: visit.familyId,
        childId: visit.childId,
        visitDate: visit.visitDate.toISOString(),
        weight: visit.weight,
        armCircumference: visit.armCircumference,
        height: visit.height,
        incap: visit.incap,
        leche: visit.leche,
        bagsGiven: visit.bagsGiven,
        recvAnyMedicine: visit.recvAnyMedicine,
        leftFromProg: visit.leftFromProg,
        passedAway: visit.passedAway,
        questions: Array.isArray(visit.questions) ? visit.questions as unknown as ChildVisitQuestion[] : [],
        notes: visit.notes,
        createdAt: visit.createdAt.toISOString(),
        updatedAt: visit.updatedAt.toISOString(),
        child: {
          id: visit.child!.id,
          name: visit.child!.name,
          familyId: visit.child!.familyId,
        },
      })),
      familyVisits: recentFamilyVisits.map((visit: any) => ({
        id: visit.id,
        localId: visit.localId,
        familyId: visit.familyId,
        visitDate: visit.visitDate.toISOString(),
        trainingsReceived: Array.isArray(visit.trainingsReceived) ? visit.trainingsReceived as unknown as TrainingReceived[] : [],
        resourcesReceived: Array.isArray(visit.resourcesReceived) ? visit.resourcesReceived as unknown as ResourceReceived[] : [],
        questions: Array.isArray(visit.questions) ? visit.questions as unknown as FamilyVisitQuestion[] : [],
        notes: visit.notes,
        createdAt: visit.createdAt.toISOString(),
        updatedAt: visit.updatedAt.toISOString(),
        family: {
          id: visit.family!.id,
          familyName: visit.family!.familyName,
        },
      })),
    },
    recentlyUpdatedChildren: recentlyUpdatedChildren.map((child: any) => ({
      id: child.id,
      localId: child.localId,
      familyId: child.familyId,
      name: child.name,
      birthDate: child.birthDate.toISOString(),
      sex: child.sex,
      dateEntered: child.dateEntered?.toISOString() || null,
      photos: child.photos as number[],
      weight: child.weight,
      nutritionalState: child.nutritionalState,
      reasonEnrollment: child.reasonEnrollment,
      observations: child.observations,
      createdAt: child.createdAt.toISOString(),
      updatedAt: child.updatedAt.toISOString(),
      family: {
        id: child.family!.id,
        familyName: child.family!.familyName,
      },
      latestVisit: child.childVisits.length > 0 ? {
        id: child.childVisits[0]!.id,
        visitDate: child.childVisits[0]!.visitDate.toISOString(),
        weight: child.childVisits[0]!.weight,
        height: child.childVisits[0]!.height,
        armCircumference: child.childVisits[0]!.armCircumference,
      } : null,
    })),
    familiesInCrisis: familiesInCrisis.map((family: any) => ({
      id: family.id,
      localId: family.localId,
      familyName: family.familyName,
      childrenEditable: family.childrenEditable,
      inCrisis: family.inCrisis,
      notes: family.notes,
      communityId: family.communityId,
      siteId: family.siteId,
      birthingAssistantId: family.birthingAssistantId,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
      childrenCount: family.children.length,
      lastVisitDate: family.familyVisits.length > 0
        ? family.familyVisits[0]!.visitDate.toISOString()
        : null,
    })),
    stats: {
      totalFamilies,
      totalChildren,
      familiesInCrisis: familiesInCrisisCount,
      visitsThisMonth,
    },
    visitsPerMonth,
    communityBreakdown,
  };

  return dashboardData;
}