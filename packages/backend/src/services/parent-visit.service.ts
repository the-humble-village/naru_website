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

// ParentVisit is NOT registered in the soft-delete Prisma extension
// (src/middleware/soft-delete.ts), so every query in this service has to filter
// `deletedAt: null` explicitly. Without it a soft-deleted parent visit would still be
// listed, fetched and editable.
const NOT_DELETED = { deletedAt: null } as const;

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

  const where = { familyId, parentId, ...NOT_DELETED };

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
    where: { id: visitId, familyId, parentId, ...NOT_DELETED },
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
    where: { id: visitId, familyId, parentId, ...NOT_DELETED },
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

  // Every mutable column on ParentVisit is represented below — weight, the
  // trainingsReceived / resourcesReceived lists, the questions answer array and the
  // photos array included. All of them are inline JSON on the row (no answer rows with
  // their own deletedAt), so the create path's whole-array replace strategy applies.
  if (data.visitDate !== undefined) updateData.visitDate = new Date(data.visitDate);
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

/**
 * Delete parent visit by ID (soft delete)
 * Only supervisors and admins can delete parent visits
 */
export async function deleteParentVisit(
  familyId: number,
  parentId: number,
  visitId: number,
  user: UserRead
): Promise<void> {
  await validateFamilyAndParent(familyId, parentId);

  // An already-deleted visit is excluded by NOT_DELETED, so a second delete returns 404
  const existingVisit = await prisma.parentVisit.findFirst({
    where: { id: visitId, familyId, parentId, ...NOT_DELETED },
    select: { id: true },
  });

  if (!existingVisit) {
    throw new HTTPException(404, { message: 'Parent visit not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // Soft delete the visit. Weight, trainings, resources, question answers and photos
  // all live inline on this row, so there is nothing to cascade.
  await prisma.parentVisit.update({
    where: { id: visitId },
    data: { deletedAt: new Date() },
  });
}
