import { type SearchResponse, type SearchResultItem, type UserRead } from '@naru/shared';
import prisma from '../db.js';

const TAKE_PER_TYPE = 50;
const ACTIVE_ENROLLMENT = { where: { exitedAt: null, deletedAt: null } } as const;

/**
 * Search across families, mothers, children and people by name
 */
export async function searchByName(query: string, user: UserRead): Promise<SearchResponse> {
  if (!query || query.trim().length === 0) {
    return {
      results: [],
      total: 0,
      query: query,
    };
  }

  const trimmedQuery = query.trim();

  const searchCondition = {
    contains: trimmedQuery,
    mode: 'insensitive' as const,
  };

  // TODO: When we implement user assignment/scoping, filter by assignment here.

  const [families, mothers, children, people] = await Promise.all([
    prisma.family.findMany({
      where: { familyName: searchCondition },
      select: {
        id: true,
        familyName: true,
        communityId: true,
        _count: { select: { enrollments: ACTIVE_ENROLLMENT } },
      },
      take: TAKE_PER_TYPE,
    }),
    prisma.mother.findMany({
      where: { name: searchCondition },
      select: {
        id: true,
        name: true,
        familyId: true,
        communityId: true,
        family: { select: { familyName: true } },
        _count: { select: { enrollments: ACTIVE_ENROLLMENT } },
      },
      take: TAKE_PER_TYPE,
    }),
    prisma.child.findMany({
      where: { name: searchCondition },
      select: {
        id: true,
        name: true,
        familyId: true,
        communityId: true,
        family: { select: { familyName: true } },
        _count: { select: { enrollments: ACTIVE_ENROLLMENT } },
      },
      take: TAKE_PER_TYPE,
    }),
    prisma.person.findMany({
      where: { name: searchCondition },
      select: {
        id: true,
        name: true,
        communityId: true,
        _count: { select: { enrollments: ACTIVE_ENROLLMENT } },
      },
      take: TAKE_PER_TYPE,
    }),
  ]);

  const results: SearchResultItem[] = [
    ...families.map((family: any) => ({
      id: family.id,
      type: 'family' as const,
      name: family.familyName,
      familyId: family.id,
      familyName: family.familyName,
      communityId: family.communityId,
      activeEnrollments: family._count.enrollments,
    })),
    ...mothers.map((mother: any) => ({
      id: mother.id,
      type: 'mother' as const,
      name: mother.name,
      familyId: mother.familyId,
      familyName: mother.family?.familyName ?? null,
      communityId: mother.communityId,
      activeEnrollments: mother._count.enrollments,
    })),
    ...children.map((child: any) => ({
      id: child.id,
      type: 'child' as const,
      name: child.name,
      familyId: child.familyId,
      familyName: child.family?.familyName ?? null,
      communityId: child.communityId,
      activeEnrollments: child._count.enrollments,
    })),
    ...people.map((person: any) => ({
      id: person.id,
      type: 'person' as const,
      name: person.name,
      familyId: null,
      familyName: null,
      communityId: person.communityId,
      activeEnrollments: person._count.enrollments,
    })),
  ];

  results.sort((a, b) => {
    const typeOrder: Record<string, number> = { family: 1, mother: 2, child: 3, person: 4 };
    const typeComparison = typeOrder[a.type]! - typeOrder[b.type]!;
    if (typeComparison !== 0) return typeComparison;

    const aName = a.name || '';
    const bName = b.name || '';
    return aName.toLowerCase().localeCompare(bName.toLowerCase());
  });

  return {
    results: results.slice(0, 100),
    total: results.length,
    query: trimmedQuery,
  };
}
