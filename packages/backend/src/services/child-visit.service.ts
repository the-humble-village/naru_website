import { HTTPException } from 'hono/http-exception';
import {
  type ChildVisitCreate,
  type ChildVisitUpdate,
  type ChildVisitRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List child visits for a specific child
 */
export async function listChildVisits(
  familyId: number,
  childId: number,
  user: UserRead,
  options: {
    skip?: number;
    limit?: number;
  } = {}
): Promise<ChildVisitRead[]> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if the child exists and belongs to the family
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
    },
    select: { id: true },
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  const { skip = 0, limit = 50 } = options;

  const childVisits = await prisma.childVisit.findMany({
    where: {
      familyId,
      childId,
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
      // Explicitly exclude deletedAt
    },
    orderBy: {
      visitDate: 'desc', // Most recent visits first
    },
    skip,
    take: limit,
  });

  // Transform dates to ISO strings and cast questions
  const childVisitsRead: ChildVisitRead[] = childVisits.map((visit: any) => ({
    ...visit,
    questions: visit.questions as any, // Cast JsonValue to ChildVisitQuestion[]
    visitDate: visit.visitDate.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  }));

  return childVisitsRead;
}

/**
 * Create a new child visit
 */
export async function createChildVisit(data: ChildVisitCreate): Promise<ChildVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: data.familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if the child exists and belongs to the family
  const child = await prisma.child.findFirst({
    where: {
      id: data.childId,
      familyId: data.familyId,
    },
    select: { id: true },
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // If localId is provided, check for uniqueness
  if (data.localId) {
    const existingVisit = await prisma.childVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingVisit) {
      throw new HTTPException(400, { message: 'Child visit with this localId already exists' });
    }
  }

  // Create child visit
  const childVisit = await prisma.childVisit.create({
    data: {
      familyId: data.familyId,
      childId: data.childId,
      visitDate: new Date(data.visitDate),
      weight: data.weight ?? 0,
      armCircumference: data.armCircumference ?? 0,
      height: data.height ?? 0,
      incap: data.incap ?? false,
      leche: data.leche ?? false,
      bagsGiven: data.bagsGiven,
      recvAnyMedicine: data.recvAnyMedicine,
      leftFromProg: data.leftFromProg,
      passedAway: data.passedAway,
      questions: data.questions ?? [],
      notes: data.notes,
      localId: data.localId,
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings and cast questions
  const childVisitRead: ChildVisitRead = {
    ...childVisit,
    questions: childVisit.questions as any, // Cast JsonValue to ChildVisitQuestion[]
    visitDate: childVisit.visitDate.toISOString(),
    createdAt: childVisit.createdAt.toISOString(),
    updatedAt: childVisit.updatedAt.toISOString(),
  };

  return childVisitRead;
}

/**
 * Get child visit by ID
 */
export async function getChildVisitById(
  familyId: number,
  childId: number,
  visitId: number,
  user: UserRead
): Promise<ChildVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if the child exists and belongs to the family
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
    },
    select: { id: true },
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  const childVisit = await prisma.childVisit.findFirst({
    where: {
      id: visitId,
      familyId: familyId,
      childId: childId,
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
      // Explicitly exclude deletedAt
    },
  });

  if (!childVisit) {
    throw new HTTPException(404, { message: 'Child visit not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // Transform dates to ISO strings and cast questions
  const childVisitRead: ChildVisitRead = {
    ...childVisit,
    questions: childVisit.questions as any, // Cast JsonValue to ChildVisitQuestion[]
    visitDate: childVisit.visitDate.toISOString(),
    createdAt: childVisit.createdAt.toISOString(),
    updatedAt: childVisit.updatedAt.toISOString(),
  };

  return childVisitRead;
}

/**
 * Update child visit by ID
 */
export async function updateChildVisit(
  familyId: number,
  childId: number,
  visitId: number,
  data: ChildVisitUpdate,
  user: UserRead
): Promise<ChildVisitRead> {
  // First check if the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // Check if the child exists and belongs to the family
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      familyId: familyId,
    },
    select: { id: true },
  });

  if (!child) {
    throw new HTTPException(404, { message: 'Child not found' });
  }

  // Check if child visit exists
  const existingVisit = await prisma.childVisit.findFirst({
    where: {
      id: visitId,
      familyId: familyId,
      childId: childId,
    },
    select: { id: true, localId: true },
  });

  if (!existingVisit) {
    throw new HTTPException(404, { message: 'Child visit not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control here

  // If updating localId, check for uniqueness
  if (data.localId && data.localId !== existingVisit.localId) {
    const localIdExists = await prisma.childVisit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Child visit with this localId already exists' });
    }
  }

  // Prepare update data
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only include fields that are provided in the update
  if (data.visitDate !== undefined) updateData.visitDate = data.visitDate ? new Date(data.visitDate) : null;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.armCircumference !== undefined) updateData.armCircumference = data.armCircumference;
  if (data.height !== undefined) updateData.height = data.height;
  if (data.incap !== undefined) updateData.incap = data.incap;
  if (data.leche !== undefined) updateData.leche = data.leche;
  if (data.bagsGiven !== undefined) updateData.bagsGiven = data.bagsGiven;
  if (data.recvAnyMedicine !== undefined) updateData.recvAnyMedicine = data.recvAnyMedicine;
  if (data.leftFromProg !== undefined) updateData.leftFromProg = data.leftFromProg;
  if (data.passedAway !== undefined) updateData.passedAway = data.passedAway;
  if (data.questions !== undefined) updateData.questions = data.questions;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  // Update child visit
  const updatedVisit = await prisma.childVisit.update({
    where: { id: visitId },
    data: updateData,
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
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings and cast questions
  const childVisitRead: ChildVisitRead = {
    ...updatedVisit,
    questions: updatedVisit.questions as any, // Cast JsonValue to ChildVisitQuestion[]
    visitDate: updatedVisit.visitDate.toISOString(),
    createdAt: updatedVisit.createdAt.toISOString(),
    updatedAt: updatedVisit.updatedAt.toISOString(),
  };

  return childVisitRead;
}