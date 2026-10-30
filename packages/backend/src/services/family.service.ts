import { HTTPException } from 'hono/http-exception';
import {
  type FamilyCreate,
  type FamilyUpdate,
  type FamilyRead,
  type FamilyListItem,
  type UserRead
} from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly } from '../utils/date.js';

const FAMILY_SELECT = {
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
  // Explicitly exclude deletedAt
} as const;

function toFamilyRead(family: any): FamilyRead {
  return {
    ...family,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };
}

/**
 * List families with optional pagination and filtering
 */
export async function listFamilies(options: {
  search?: string;
  skip?: number;
  limit?: number;
  communityId?: string;
  siteId?: string;
  inCrisis?: string;
  unenrolled?: boolean;
  user: UserRead;
} = {} as any): Promise<{ families: FamilyListItem[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 per page

  const where: any = {};

  if (options.search && options.search.trim()) {
    where.familyName = {
      contains: options.search.trim(),
      mode: 'insensitive',
    };
  }

  if (options.communityId) {
    const communityIdNum = parseInt(options.communityId, 10);
    if (!isNaN(communityIdNum)) {
      where.communityId = communityIdNum;
    }
  }

  // A family has no site of its own — Site is a rollup of Community, so the
  // filter reaches through the community.
  if (options.siteId) {
    const siteIdNum = parseInt(options.siteId, 10);
    if (!isNaN(siteIdNum)) {
      where.community = { siteId: siteIdNum };
    }
  }

  if (options.inCrisis !== undefined) {
    where.inCrisis = options.inCrisis === 'true';
  }

  // "Unenrolled" needs no schema support — it is zero active enrollment rows
  // (SCHEMA_V2.md §9.4). This is the same predicate getUnenrolledCount uses, so
  // the sidebar badge and the worklist cannot disagree.
  if (options.unenrolled) {
    where.enrollments = { none: { exitedAt: null, deletedAt: null } };
  }

  // TODO: When we implement user assignment/scoping, add this logic:
  // if (options.user.role === 'CASEWORKER') {
  //   where.assignedUserId = options.user.id;
  // }

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      skip,
      take: limit,
      select: {
        ...FAMILY_SELECT,
        community: { select: { siteId: true } },
        enrollments: {
          select: {
            visits: {
              take: 1,
              orderBy: { visitDate: 'desc' },
              select: { visitDate: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
    prisma.family.count({ where }),
  ]);

  const familiesRead: FamilyListItem[] = families.map(
    ({ community, enrollments, ...family }: any) => {
      const visitDates: Date[] = enrollments
        .flatMap((enrollment: any) => enrollment.visits)
        .map((visit: any) => visit.visitDate);

      const lastVisit = visitDates.length
        ? visitDates.reduce((a, b) => (a > b ? a : b))
        : null;

      return {
        ...toFamilyRead(family),
        siteId: community?.siteId ?? null,
        lastVisitDate: toDateOnly(lastVisit),
      };
    }
  );

  return {
    families: familiesRead,
    total,
  };
}

/**
 * Create a new family
 */
export async function createFamily(data: FamilyCreate): Promise<FamilyRead> {
  if (data.localId) {
    const existingFamily = await prisma.family.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingFamily) {
      throw new HTTPException(400, { message: 'Family with this localId already exists' });
    }
  }

  const family = await prisma.family.create({
    data: {
      familyName: data.familyName,
      communityId: data.communityId,
      phone: data.phone,
      caretaker2Name: data.caretaker2Name,
      incomeSources: data.incomeSources,
      deathsNotes: data.deathsNotes,
      inCrisis: data.inCrisis ?? false,
      notes: data.notes,
      localId: data.localId,
    },
    select: FAMILY_SELECT,
  });

  return toFamilyRead(family);
}

/**
 * Get family by ID
 */
export async function getFamilyById(id: number, user: UserRead): Promise<FamilyRead> {
  const family = await prisma.family.findUnique({
    where: { id },
    select: FAMILY_SELECT,
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to this family' });
  // }

  return toFamilyRead(family);
}

/**
 * Update family by ID
 */
export async function updateFamily(id: number, data: FamilyUpdate, user: UserRead): Promise<FamilyRead> {
  const existingFamily = await prisma.family.findUnique({
    where: { id },
    select: { id: true, localId: true },
  });

  if (!existingFamily) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  if (data.localId && data.localId !== existingFamily.localId) {
    const localIdExists = await prisma.family.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Family with this localId already exists' });
    }
  }

  const updatedFamily = await prisma.family.update({
    where: { id },
    data: {
      familyName: data.familyName,
      communityId: data.communityId,
      phone: data.phone,
      caretaker2Name: data.caretaker2Name,
      incomeSources: data.incomeSources,
      deathsNotes: data.deathsNotes,
      inCrisis: data.inCrisis,
      notes: data.notes,
      localId: data.localId,
      updatedAt: new Date(),
    },
    select: FAMILY_SELECT,
  });

  return toFamilyRead(updatedFamily);
}

/**
 * Delete family by ID (soft delete)
 * Only supervisors and admins can delete families
 */
export async function deleteFamily(id: number, user: UserRead): Promise<void> {
  const existingFamily = await prisma.family.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingFamily) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  await prisma.family.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}
