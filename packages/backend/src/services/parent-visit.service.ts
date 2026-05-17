import { HTTPException } from 'hono/http-exception';
import {
  type ParentVisitCreate,
  type ParentVisitUpdate,
  type ParentVisitRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

const PARENT_VISIT_SELECT = {
  id: true,
  localId: true,
  familyId: true,
  parentId: true,
  visitDate: true,
  weight: true,
  trainingsReceived: true,
  resourcesReceived: true,
  questions: true,
  photos: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // Explicitly exclude deletedAt
} as const;

function toRead(visit: {
  id: number;
  localId: string | null;
  familyId: number;
  parentId: number;
  visitDate: Date;
  weight: number;
  trainingsReceived: unknown;
  resourcesReceived: unknown;
  questions: unknown;
  photos: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ParentVisitRead {
  return {
    ...visit,
    trainingsReceived: visit.trainingsReceived as ParentVisitRead['trainingsReceived'],
    resourcesReceived: visit.resourcesReceived as ParentVisitRead['resourcesReceived'],
    questions: visit.questions as ParentVisitRead['questions'],
    photos: visit.photos as number[],
    visitDate: visit.visitDate.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  };
}

async function validateFamilyAndParent(familyId: number, parentId: number) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  const parent = await prisma.parent.findFirst({
    where: { id: parentId, familyId },
    select: { id: true },
  });

  if (!parent) {
    throw new HTTPException(404, { message: 'Parent not found' });
  }
}

/**
 * List parent visits for a specific parent
 */
export async function listParentVisits(
  familyId: number,
  parentId: number,
  user: UserRead,
  options: { skip?: number; limit?: number } = {}
): Promise<{ visits: ParentVisitRead[]; total: number; skip: number; limit: number }> {
  await validateFamilyAndParent(familyId, parentId);

  const { skip = 0, limit = 50 } = options;

  const where = { familyId, parentId };

  const [parentVisits, total] = await Promise.all([
    prisma.parentVisit.findMany({
      where,
      select: PARENT_VISIT_SELECT,
      orderBy: { visitDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.parentVisit.count({ where }),
  ]);

  return { visits: parentVisits.map(toRead), total, skip, limit };
}

/**
 * Create a new parent visit
 */
export async function createParentVisit(data: ParentVisitCreate): Promise<ParentVisitRead> {
  await validateFamilyAndParent(data.familyId, data.parentId);

  if (data.localId) {
    const existingVisit = await prisma.parentVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingVisit) {
      throw new HTTPException(400, { message: 'Parent visit with this localId already exists' });
    }
  }

  const parentVisit = await prisma.parentVisit.create({
    data: {
      familyId: data.familyId,
      parentId: data.parentId,
      visitDate: new Date(data.visitDate),
      weight: data.weight ?? 0,
      trainingsReceived: data.trainingsReceived ?? [],
      resourcesReceived: data.resourcesReceived ?? [],
      questions: data.questions ?? [],
      photos: data.photos ?? [],
      notes: data.notes,
      localId: data.localId,
    },
    select: PARENT_VISIT_SELECT,
  });

  return toRead(parentVisit);
}

/**
 * Get parent visit by ID
 */
export async function getParentVisitById(
  familyId: number,
  parentId: number,
  visitId: number,
  user: UserRead
): Promise<ParentVisitRead> {
  await validateFamilyAndParent(familyId, parentId);

  const parentVisit = await prisma.parentVisit.findFirst({
    where: { id: visitId, familyId, parentId },
    select: PARENT_VISIT_SELECT,
  });

  if (!parentVisit) {
    throw new HTTPException(404, { message: 'Parent visit not found' });
  }

  return toRead(parentVisit);
}

/**
 * Update parent visit by ID
 */
export async function updateParentVisit(
  familyId: number,
  parentId: number,
  visitId: number,
  data: ParentVisitUpdate,
  user: UserRead
): Promise<ParentVisitRead> {
  await validateFamilyAndParent(familyId, parentId);

  const existingVisit = await prisma.parentVisit.findFirst({
    where: { id: visitId, familyId, parentId },
    select: { id: true, localId: true },
  });

  if (!existingVisit) {
    throw new HTTPException(404, { message: 'Parent visit not found' });
  }

  if (data.localId && data.localId !== existingVisit.localId) {
    const localIdExists = await prisma.parentVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Parent visit with this localId already exists' });
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.visitDate !== undefined) updateData.visitDate = data.visitDate ? new Date(data.visitDate) : null;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.trainingsReceived !== undefined) updateData.trainingsReceived = data.trainingsReceived;
  if (data.resourcesReceived !== undefined) updateData.resourcesReceived = data.resourcesReceived;
  if (data.questions !== undefined) updateData.questions = data.questions;
  if (data.photos !== undefined) updateData.photos = data.photos;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  const updatedVisit = await prisma.parentVisit.update({
    where: { id: visitId },
    data: updateData,
    select: PARENT_VISIT_SELECT,
  });

  return toRead(updatedVisit);
}
