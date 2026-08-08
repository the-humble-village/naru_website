import { HTTPException } from 'hono/http-exception';
import {
  type FamilyCreate,
  type FamilyUpdate,
  type FamilyRead,
  type UserRead
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List families with optional pagination and filtering
 * Caseworkers see only their assigned families, supervisors+ see all
 */
export async function listFamilies(options: {
  search?: string;
  skip?: number;
  limit?: number;
  communityId?: string;
  siteId?: string;
  inCrisis?: string;
  user: UserRead;
} = {} as any): Promise<{ families: FamilyRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 per page

  // Build where clause based on filters
  const where: any = {};

  // Search filter (family name)
  if (options.search && options.search.trim()) {
    where.familyName = {
      contains: options.search.trim(),
      mode: 'insensitive',
    };
  }

  // Community filter
  if (options.communityId) {
    const communityIdNum = parseInt(options.communityId, 10);
    if (!isNaN(communityIdNum)) {
      where.communityId = communityIdNum;
    }
  }

  // Site filter
  if (options.siteId) {
    const siteIdNum = parseInt(options.siteId, 10);
    if (!isNaN(siteIdNum)) {
      where.siteId = siteIdNum;
    }
  }

  // Crisis filter
  if (options.inCrisis !== undefined) {
    const inCrisisBool = options.inCrisis === 'true';
    where.inCrisis = inCrisisBool;
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
        id: true,
        localId: true,
        familyName: true,
        childrenEditable: true,
        inCrisis: true,
        notes: true,
        communityId: true,
        siteId: true,
        birthingAssistantId: true,
        photos: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude deletedAt
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
    prisma.family.count({ where }),
  ]);

  // Transform dates to ISO strings
  const familiesRead: FamilyRead[] = families.map((family: any) => ({
    ...family,
    photos: family.photos as number[],
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  }));

  return {
    families: familiesRead,
    total,
  };
}

/**
 * Create a new family
 */
export async function createFamily(data: FamilyCreate): Promise<FamilyRead> {
  // If localId is provided, check for uniqueness
  if (data.localId) {
    const existingFamily = await prisma.family.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingFamily) {
      throw new HTTPException(400, { message: 'Family with this localId already exists' });
    }
  }

  // Create family
  const family = await prisma.family.create({
    data: {
      familyName: data.familyName,
      childrenEditable: data.childrenEditable ?? 0,
      inCrisis: data.inCrisis ?? false,
      notes: data.notes,
      communityId: data.communityId,
      siteId: data.siteId,
      birthingAssistantId: data.birthingAssistantId,
      photos: data.photos ?? [],
      localId: data.localId,
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const familyRead: FamilyRead = {
    ...family,
    photos: family.photos as number[],
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };

  return familyRead;
}

/**
 * Get family by ID with related data
 */
export async function getFamilyById(id: number, user: UserRead): Promise<FamilyRead> {
  const family = await prisma.family.findUnique({
    where: { id },
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
      // Explicitly exclude deletedAt
    },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to this family' });
  // }

  // Transform dates to ISO strings
  const familyRead: FamilyRead = {
    ...family,
    photos: family.photos as number[],
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };

  return familyRead;
}

/**
 * Update family by ID
 */
export async function updateFamily(id: number, data: FamilyUpdate, user: UserRead): Promise<FamilyRead> {
  // Check if family exists first
  const existingFamily = await prisma.family.findUnique({
    where: { id },
    select: { id: true, localId: true },
  });

  if (!existingFamily) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && existingFamily.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to update this family' });
  // }

  // If updating localId, check for uniqueness
  if (data.localId && data.localId !== existingFamily.localId) {
    const localIdExists = await prisma.family.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Family with this localId already exists' });
    }
  }

  // Update family
  const updatedFamily = await prisma.family.update({
    where: { id },
    data: {
      familyName: data.familyName,
      childrenEditable: data.childrenEditable,
      inCrisis: data.inCrisis,
      notes: data.notes,
      communityId: data.communityId,
      siteId: data.siteId,
      birthingAssistantId: data.birthingAssistantId,
      photos: data.photos !== undefined ? data.photos : undefined,
      localId: data.localId,
      updatedAt: new Date(),
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const familyRead: FamilyRead = {
    ...updatedFamily,
    photos: updatedFamily.photos as number[],
    createdAt: updatedFamily.createdAt.toISOString(),
    updatedAt: updatedFamily.updatedAt.toISOString(),
  };

  return familyRead;
}

/**
 * Delete family by ID (soft delete)
 * Only supervisors and admins can delete families
 */
export async function deleteFamily(id: number, user: UserRead): Promise<void> {
  // Check if family exists first
  const existingFamily = await prisma.family.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingFamily) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Soft delete the family
  await prisma.family.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}