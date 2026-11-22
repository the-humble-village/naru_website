import { HTTPException } from 'hono/http-exception';
import {
  type ChildCreate,
  type ChildUpdate,
  type ChildRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

const CHILD_SELECT = {
  id: true,
  localId: true,
  name: true,
  birthDate: true,
  sex: true,
  communityId: true,
  motherId: true,
  familyId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // Explicitly exclude deletedAt
} as const;

function toChildRead(child: any): ChildRead {
  return {
    ...child,
    birthDate: child.birthDate.toISOString(),
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}

/**
 * List children, optionally filtered by family, mother, community, or enrollment state
 */
export async function listChildren(options: {
  familyId?: number;
  motherId?: number;
  communityId?: number;
  siteId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ children: ChildRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};

  if (options.familyId !== undefined) where.familyId = options.familyId;
  if (options.motherId !== undefined) where.motherId = options.motherId;
  if (options.communityId !== undefined) where.communityId = options.communityId;

  // Site is a rollup of Community — a subject stores only communityId, so a site
  // filter has to go through the relation (SCHEMA_V2.md §6.7).
  if (options.siteId !== undefined) where.community = { siteId: options.siteId };

  if (options.search && options.search.trim()) {
    where.name = { contains: options.search.trim(), mode: 'insensitive' };
  }

  // "Unenrolled" needs no schema support — it is zero active enrollment rows.
  // This is the worklist that migrated profiles land on (SCHEMA_V2.md §9.4).
  if (options.unenrolled) {
    where.enrollments = {
      none: { exitedAt: null, deletedAt: null },
    };
  }

  const [children, total] = await Promise.all([
    prisma.child.findMany({
      where,
      skip,
      take: limit,
      select: CHILD_SELECT,
      orderBy: { name: 'asc' },
    }),
    prisma.child.count({ where }),
  ]);

  return { children: children.map(toChildRead), total };
}

/**
 * Create a new child
 */
export async function createChild(data: ChildCreate): Promise<ChildRead> {
  if (data.familyId) {
    const family = await prisma.family.findFirst({
      where: { id: data.familyId, deletedAt: null },
      select: { id: true },
    });

    if (!family) {
      throw new HTTPException(404, { message: 'Family not found' });
    }
  }

  if (data.motherId) {
    const mother = await prisma.mother.findFirst({
      where: { id: data.motherId, deletedAt: null },
      select: { id: true },
    });

    if (!mother) {
      throw new HTTPException(404, { message: 'Mother not found' });
    }
  }

  if (data.localId) {
    const existingChild = await prisma.child.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingChild) {
      throw new HTTPException(400, { message: 'Child with this localId already exists' });
    }
  }

  const child = await prisma.child.create({
    data: {
      name: data.name,
      birthDate: new Date(data.birthDate),
      sex: data.sex,
      communityId: data.communityId,
      motherId: data.motherId,
      familyId: data.familyId,
      notes: data.notes,
      localId: data.localId,
    },
    select: CHILD_SELECT,
  });

  return toChildRead(child);
}

/**
 * Get child by ID
 */
export async function getChildById(childId: number, user: UserRead): Promise<ChildRead> {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: CHILD_SELECT,
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  return toChildRead(child);
}

/**
 * Update child by ID
 */
export async function updateChild(childId: number, data: ChildUpdate, user: UserRead): Promise<ChildRead> {
  const existingChild = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true, localId: true },
  });

  if (!existingChild) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  if (data.localId && data.localId !== existingChild.localId) {
    const localIdExists = await prisma.child.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Child with this localId already exists' });
    }
  }

  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
  if (data.sex !== undefined) updateData.sex = data.sex;
  if (data.communityId !== undefined) updateData.communityId = data.communityId;
  if (data.motherId !== undefined) updateData.motherId = data.motherId;
  if (data.familyId !== undefined) updateData.familyId = data.familyId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  const updatedChild = await prisma.child.update({
    where: { id: childId },
    data: updateData,
    select: CHILD_SELECT,
  });

  return toChildRead(updatedChild);
}

/**
 * Delete child by ID (soft delete)
 * Only supervisors and admins can delete children
 */
export async function deleteChild(childId: number, user: UserRead): Promise<void> {
  const existingChild = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true },
  });

  if (!existingChild) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  await prisma.child.update({
    where: { id: childId },
    data: {
      deletedAt: new Date(),
    },
  });
}
