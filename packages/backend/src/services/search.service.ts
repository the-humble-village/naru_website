import { type SearchResponse, type UserRead } from '@naru/shared';
import prisma from '../db';

/**
 * Search across families, parents, and children by name
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

  // Create search conditions for case-insensitive partial matching
  const searchCondition = {
    contains: trimmedQuery,
    mode: 'insensitive' as const,
  };

  // TODO: When we implement user assignment/scoping, add this logic:
  // const familyWhere = user.role === 'CASEWORKER'
  //   ? { assignedUserId: user.id }
  //   : {};

  const familyWhere = {}; // For now, no scoping

  // Search families by name
  const familiesPromise = prisma.family.findMany({
    where: {
      ...familyWhere,
      familyName: searchCondition,
    },
    select: {
      id: true,
      familyName: true,
    },
    take: 50, // Limit results to prevent excessive queries
  });

  // Search parents by name
  const parentsPromise = prisma.parent.findMany({
    where: {
      name: searchCondition,
      family: familyWhere,
    },
    select: {
      id: true,
      name: true,
      familyId: true,
      family: {
        select: {
          familyName: true,
        },
      },
    },
    take: 50,
  });

  // Search children by name
  const childrenPromise = prisma.child.findMany({
    where: {
      name: searchCondition,
      family: familyWhere,
    },
    select: {
      id: true,
      name: true,
      familyId: true,
      family: {
        select: {
          familyName: true,
        },
      },
    },
    take: 50,
  });

  // Execute all searches in parallel
  const [families, parents, children] = await Promise.all([
    familiesPromise,
    parentsPromise,
    childrenPromise,
  ]);

  // Transform results into unified format
  const results = [
    // Family results
    ...families.map((family: any) => ({
      id: family.id,
      type: 'family' as const,
      name: family.familyName,
      familyId: family.id,
      familyName: family.familyName,
    })),
    // Parent results
    ...parents.map((parent: any) => ({
      id: parent.id,
      type: 'parent' as const,
      name: parent.name,
      familyId: parent.familyId,
      familyName: parent.family.familyName,
    })),
    // Child results
    ...children.map((child: any) => ({
      id: child.id,
      type: 'child' as const,
      name: child.name,
      familyId: child.familyId,
      familyName: child.family.familyName,
    })),
  ];

  // Sort results by type (families first, then parents, then children)
  results.sort((a, b) => {
    const typeOrder: Record<string, number> = { family: 1, parent: 2, child: 3 };
    const typeComparison = typeOrder[a.type]! - typeOrder[b.type]!;
    if (typeComparison !== 0) return typeComparison;

    // Within same type, sort by name (case-insensitive)
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.toLowerCase().localeCompare(bName.toLowerCase());
  });

  return {
    results: results.slice(0, 100), // Limit total results to 100
    total: results.length,
    query: trimmedQuery,
  };
}