import { HTTPException } from 'hono/http-exception';
import {
  type ChildCreate,
  type ChildUpdate,
  type ChildRead,
  type UserRead,
  ageInDays,
  weightForAge,
  armCircumferenceForAge,
  classifyZScore,
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List children for a family
 */
export async function listChildren(familyId: number, user: UserRead): Promise<ChildRead[]> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  const children = await prisma.child.findMany({
    where: { familyId },
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
      // Explicitly exclude deletedAt
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Transform dates to ISO strings
  const childrenRead: ChildRead[] = children.map((child: any) => ({
    ...child,
    birthDate: child.birthDate.toISOString(),
    dateEntered: child.dateEntered?.toISOString() || null,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  }));

  return childrenRead;
}

/**
 * Create a new child
 */
export async function createChild(data: ChildCreate): Promise<ChildRead> {
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
    const existingChild = await prisma.child.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingChild) {
      throw new HTTPException(400, { message: 'Child with this localId already exists' });
    }
  }

  // Create child
  const child = await prisma.child.create({
    data: {
      familyId: data.familyId,
      name: data.name,
      birthDate: new Date(data.birthDate),
      sex: data.sex,
      dateEntered: data.dateEntered ? new Date(data.dateEntered) : null,
      photos: data.photos,
      weight: data.weight ?? 0,
      nutritionalState: data.nutritionalState,
      reasonEnrollment: data.reasonEnrollment,
      observations: data.observations,
      localId: data.localId,
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const childRead: ChildRead = {
    ...child,
    photos: child.photos as number[],
    birthDate: child.birthDate.toISOString(),
    dateEntered: child.dateEntered?.toISOString() || null,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };

  return childRead;
}

/**
 * Get child by ID with z-scores calculated
 */
export async function getChildById(familyId: number, childId: number, user: UserRead): Promise<ChildRead & { zScores?: any }> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
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
      // Explicitly exclude deletedAt
    },
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // Calculate z-scores if child has valid data
  const ageDaysValue = ageInDays(child.birthDate, new Date());
  let zScores = null;

  if (ageDaysValue !== null) {
    const weightKg = child.weight / 1000; // Convert grams to kg

    const weightForAgeZ = weightForAge(weightKg, ageDaysValue, child.sex);

    // For arm circumference, we need to get the latest measurement from visits
    // For now, we'll skip this since we don't have arm circumference data on the child record itself
    // This would typically come from the most recent child visit

    zScores = {
      weightForAge: weightForAgeZ ? {
        zScore: weightForAgeZ,
        classification: classifyZScore(weightForAgeZ),
      } : null,
      ageInDays: ageDaysValue,
    };
  }

  // Transform dates to ISO strings
  const childRead: ChildRead & { zScores?: any } = {
    ...child,
    photos: child.photos as number[],
    birthDate: child.birthDate.toISOString(),
    dateEntered: child.dateEntered?.toISOString() || null,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
    zScores,
  };

  return childRead;
}

/**
 * Update child by ID
 */
export async function updateChild(familyId: number, childId: number, data: ChildUpdate, user: UserRead): Promise<ChildRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if child exists
  const existingChild = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
    },
    select: { id: true, localId: true },
  });

  if (!existingChild) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // If updating localId, check for uniqueness
  if (data.localId && data.localId !== existingChild.localId) {
    const localIdExists = await prisma.child.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Child with this localId already exists' });
    }
  }

  // Prepare update data
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only include fields that are provided in the update
  if (data.name !== undefined) updateData.name = data.name;
  if (data.birthDate !== undefined) updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (data.sex !== undefined) updateData.sex = data.sex;
  if (data.dateEntered !== undefined) updateData.dateEntered = data.dateEntered ? new Date(data.dateEntered) : null;
  if (data.photos !== undefined) updateData.photos = data.photos;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.nutritionalState !== undefined) updateData.nutritionalState = data.nutritionalState;
  if (data.reasonEnrollment !== undefined) updateData.reasonEnrollment = data.reasonEnrollment;
  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.localId !== undefined) updateData.localId = data.localId;

  // Update child
  const updatedChild = await prisma.child.update({
    where: { id: childId },
    data: updateData,
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const childRead: ChildRead = {
    ...updatedChild,
    photos: updatedChild.photos as number[],
    birthDate: updatedChild.birthDate.toISOString(),
    dateEntered: updatedChild.dateEntered?.toISOString() || null,
    createdAt: updatedChild.createdAt.toISOString(),
    updatedAt: updatedChild.updatedAt.toISOString(),
  };

  return childRead;
}

/**
 * Delete child by ID (soft delete)
 * Only supervisors and admins can delete children
 */
export async function deleteChild(familyId: number, childId: number, user: UserRead): Promise<void> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if child exists
  const existingChild = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
    },
    select: { id: true },
  });

  if (!existingChild) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // Soft delete the child
  await prisma.child.update({
    where: { id: childId },
    data: {
      deletedAt: new Date(),
    },
  });
}