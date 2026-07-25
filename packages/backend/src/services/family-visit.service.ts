import { HTTPException } from 'hono/http-exception';
import {
  type FamilyVisitCreate,
  type FamilyVisitUpdate,
  type FamilyVisitRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List family visits for a specific family
 */
export async function listFamilyVisits(
  familyId: number,
  user: UserRead,
  options: {
    skip?: number;
    limit?: number;
  } = {}
): Promise<FamilyVisitRead[]> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  const { skip = 0, limit = 50 } = options;

  const familyVisits = await prisma.familyVisit.findMany({
    where: {
      familyId,
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      visitDate: true,
      trainingsReceived: true,
      resourcesReceived: true,
      questions: true,
      photos: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
    orderBy: {
      visitDate: 'desc', // Most recent visits first
    },
    skip,
    take: limit,
  });

  // Transform dates to ISO strings and cast JSON fields
  const familyVisitsRead: FamilyVisitRead[] = familyVisits.map((visit: any) => ({
    ...visit,
    trainingsReceived: visit.trainingsReceived as any, // Cast JsonValue to TrainingReceived[]
    resourcesReceived: visit.resourcesReceived as any, // Cast JsonValue to ResourceReceived[]
    questions: visit.questions as any, // Cast JsonValue to FamilyVisitQuestion[]
    photos: visit.photos as number[],
    visitDate: visit.visitDate.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  }));

  return familyVisitsRead;
}

/**
 * Create a new family visit
 */
export async function createFamilyVisit(data: FamilyVisitCreate): Promise<FamilyVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: data.familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // If localId is provided, check for uniqueness
  if (data.localId) {
    const existingVisit = await prisma.familyVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingVisit) {
      throw new HTTPException(400, { message: 'Family visit with this localId already exists' });
    }
  }

  // Create family visit
  const familyVisit = await prisma.familyVisit.create({
    data: {
      familyId: data.familyId,
      visitDate: new Date(data.visitDate),
      trainingsReceived: data.trainingsReceived ?? [],
      resourcesReceived: data.resourcesReceived ?? [],
      questions: data.questions ?? [],
      photos: data.photos ?? [],
      notes: data.notes,
      localId: data.localId,
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      visitDate: true,
      trainingsReceived: true,
      resourcesReceived: true,
      questions: true,
      photos: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings and cast JSON fields
  const familyVisitRead: FamilyVisitRead = {
    ...familyVisit,
    trainingsReceived: familyVisit.trainingsReceived as any, // Cast JsonValue to TrainingReceived[]
    resourcesReceived: familyVisit.resourcesReceived as any, // Cast JsonValue to ResourceReceived[]
    questions: familyVisit.questions as any, // Cast JsonValue to FamilyVisitQuestion[]
    photos: familyVisit.photos as number[],
    visitDate: familyVisit.visitDate.toISOString(),
    createdAt: familyVisit.createdAt.toISOString(),
    updatedAt: familyVisit.updatedAt.toISOString(),
  };

  return familyVisitRead;
}

/**
 * Get family visit by ID
 */
export async function getFamilyVisitById(
  familyId: number,
  visitId: number,
  user: UserRead
): Promise<FamilyVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  const familyVisit = await prisma.familyVisit.findFirst({
    where: {
      id: visitId,
      familyId: familyId,
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      visitDate: true,
      trainingsReceived: true,
      resourcesReceived: true,
      questions: true,
      photos: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  if (!familyVisit) {
    throw new HTTPException(404, { message: 'Family visit not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // Transform dates to ISO strings and cast JSON fields
  const familyVisitRead: FamilyVisitRead = {
    ...familyVisit,
    trainingsReceived: familyVisit.trainingsReceived as any, // Cast JsonValue to TrainingReceived[]
    resourcesReceived: familyVisit.resourcesReceived as any, // Cast JsonValue to ResourceReceived[]
    questions: familyVisit.questions as any, // Cast JsonValue to FamilyVisitQuestion[]
    photos: familyVisit.photos as number[],
    visitDate: familyVisit.visitDate.toISOString(),
    createdAt: familyVisit.createdAt.toISOString(),
    updatedAt: familyVisit.updatedAt.toISOString(),
  };

  return familyVisitRead;
}

/**
 * Update family visit by ID
 */
export async function updateFamilyVisit(
  familyId: number,
  visitId: number,
  data: FamilyVisitUpdate,
  user: UserRead
): Promise<FamilyVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if family visit exists
  const existingVisit = await prisma.familyVisit.findFirst({
    where: {
      id: visitId,
      familyId: familyId,
    },
    select: { id: true, localId: true },
  });

  if (!existingVisit) {
    throw new HTTPException(404, { message: 'Family visit not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // If updating localId, check for uniqueness
  if (data.localId && data.localId !== existingVisit.localId) {
    const localIdExists = await prisma.familyVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Family visit with this localId already exists' });
    }
  }

  // Prepare update data
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only include fields that are provided in the update
  if (data.visitDate !== undefined) updateData.visitDate = data.visitDate ? new Date(data.visitDate) : null;
  if (data.trainingsReceived !== undefined) updateData.trainingsReceived = data.trainingsReceived;
  if (data.resourcesReceived !== undefined) updateData.resourcesReceived = data.resourcesReceived;
  if (data.questions !== undefined) updateData.questions = data.questions;
  if (data.photos !== undefined) updateData.photos = data.photos;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  // Update family visit
  const updatedVisit = await prisma.familyVisit.update({
    where: { id: visitId },
    data: updateData,
    select: {
      id: true,
      localId: true,
      familyId: true,
      visitDate: true,
      trainingsReceived: true,
      resourcesReceived: true,
      questions: true,
      photos: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings and cast JSON fields
  const familyVisitRead: FamilyVisitRead = {
    ...updatedVisit,
    trainingsReceived: updatedVisit.trainingsReceived as any, // Cast JsonValue to TrainingReceived[]
    resourcesReceived: updatedVisit.resourcesReceived as any, // Cast JsonValue to ResourceReceived[]
    questions: updatedVisit.questions as any, // Cast JsonValue to FamilyVisitQuestion[]
    photos: updatedVisit.photos as number[],
    visitDate: updatedVisit.visitDate.toISOString(),
    createdAt: updatedVisit.createdAt.toISOString(),
    updatedAt: updatedVisit.updatedAt.toISOString(),
  };

  return familyVisitRead;
}