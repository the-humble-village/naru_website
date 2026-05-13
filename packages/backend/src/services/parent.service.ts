import { HTTPException } from 'hono/http-exception';
import {
  type ParentCreate,
  type ParentUpdate,
  type ParentRead,
  type UserRead
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List parents for a specific family
 */
export async function listParents(familyId: number, user: UserRead): Promise<ParentRead[]> {
  // First verify the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to this family' });
  // }

  const parents = await prisma.parent.findMany({
    where: { familyId, deletedAt: null },
    select: {
      id: true,
      localId: true,
      familyId: true,
      name: true,
      role: true,
      birthDate: true,
      dateEntered: true,
      photoId: true,
      reasonEnroll: true,
      dueDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Transform dates to ISO strings
  const parentsRead: ParentRead[] = parents.map((parent: any) => ({
    ...parent,
    birthDate: parent.birthDate?.toISOString() ?? null,
    dateEntered: parent.dateEntered?.toISOString() ?? null,
    dueDate: parent.dueDate?.toISOString() ?? null,
    createdAt: parent.createdAt.toISOString(),
    updatedAt: parent.updatedAt.toISOString(),
  }));

  return parentsRead;
}

/**
 * Create a new parent for a family
 */
export async function createParent(familyId: number, data: ParentCreate, user: UserRead): Promise<ParentRead> {
  // First verify the family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true },
  });

  if (!family) {
    throw new HTTPException(404, { message: 'Family not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to this family' });
  // }

  // If localId is provided, check for uniqueness
  if (data.localId) {
    const existingParent = await prisma.parent.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existingParent) {
      throw new HTTPException(400, { message: 'Parent with this localId already exists' });
    }
  }

  // Create parent with familyId override
  const parent = await prisma.parent.create({
    data: {
      familyId, // Use the familyId from the URL path
      name: data.name,
      role: data.role,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      dateEntered: data.dateEntered ? new Date(data.dateEntered) : null,
      photoId: data.photoId,
      reasonEnroll: data.reasonEnroll,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes,
      localId: data.localId,
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      name: true,
      role: true,
      birthDate: true,
      dateEntered: true,
      photoId: true,
      reasonEnroll: true,
      dueDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const parentRead: ParentRead = {
    ...parent,
    birthDate: parent.birthDate?.toISOString() ?? null,
    dateEntered: parent.dateEntered?.toISOString() ?? null,
    dueDate: parent.dueDate?.toISOString() ?? null,
    createdAt: parent.createdAt.toISOString(),
    updatedAt: parent.updatedAt.toISOString(),
  };

  return parentRead;
}

/**
 * Get parent by ID within a family
 */
export async function getParentById(familyId: number, parentId: number, user: UserRead): Promise<ParentRead> {
  const parent = await prisma.parent.findFirst({
    where: {
      id: parentId,
      familyId, // Ensure parent belongs to the specified family
      deletedAt: null,
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      name: true,
      role: true,
      birthDate: true,
      dateEntered: true,
      photoId: true,
      reasonEnroll: true,
      dueDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  if (!parent) {
    throw new HTTPException(404, { message: 'Parent not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && parent.family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to this parent' });
  // }

  // Transform dates to ISO strings
  const parentRead: ParentRead = {
    ...parent,
    birthDate: parent.birthDate?.toISOString() ?? null,
    dateEntered: parent.dateEntered?.toISOString() ?? null,
    dueDate: parent.dueDate?.toISOString() ?? null,
    createdAt: parent.createdAt.toISOString(),
    updatedAt: parent.updatedAt.toISOString(),
  };

  return parentRead;
}

/**
 * Update parent by ID within a family
 */
export async function updateParent(familyId: number, parentId: number, data: ParentUpdate, user: UserRead): Promise<ParentRead> {
  // Check if parent exists and belongs to the family
  const existingParent = await prisma.parent.findFirst({
    where: {
      id: parentId,
      familyId,
      deletedAt: null,
    },
    select: { id: true, localId: true },
  });

  if (!existingParent) {
    throw new HTTPException(404, { message: 'Parent not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && existingParent.family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to update this parent' });
  // }

  // If updating localId, check for uniqueness
  if (data.localId && data.localId !== existingParent.localId) {
    const localIdExists = await prisma.parent.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Parent with this localId already exists' });
    }
  }

  // Update parent
  const updatedParent = await prisma.parent.update({
    where: { id: parentId },
    data: {
      name: data.name,
      role: data.role,
      birthDate: data.birthDate ? new Date(data.birthDate) : data.birthDate === null ? null : undefined,
      dateEntered: data.dateEntered ? new Date(data.dateEntered) : data.dateEntered === null ? null : undefined,
      photoId: data.photoId,
      reasonEnroll: data.reasonEnroll,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
      notes: data.notes,
      localId: data.localId,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      localId: true,
      familyId: true,
      name: true,
      role: true,
      birthDate: true,
      dateEntered: true,
      photoId: true,
      reasonEnroll: true,
      dueDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const parentRead: ParentRead = {
    ...updatedParent,
    birthDate: updatedParent.birthDate?.toISOString() ?? null,
    dateEntered: updatedParent.dateEntered?.toISOString() ?? null,
    dueDate: updatedParent.dueDate?.toISOString() ?? null,
    createdAt: updatedParent.createdAt.toISOString(),
    updatedAt: updatedParent.updatedAt.toISOString(),
  };

  return parentRead;
}

/**
 * Delete parent by ID within a family (soft delete)
 * Only supervisors and admins can delete parents
 */
export async function deleteParent(familyId: number, parentId: number, user: UserRead): Promise<void> {
  // Check if parent exists and belongs to the family
  const existingParent = await prisma.parent.findFirst({
    where: {
      id: parentId,
      familyId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!existingParent) {
    throw new HTTPException(404, { message: 'Parent not found' });
  }

  // TODO: When we implement user assignment/scoping, add access control:
  // if (user.role === 'CASEWORKER' && existingParent.family.assignedUserId !== user.id) {
  //   throw new HTTPException(403, { message: 'Access denied to delete this parent' });
  // }

  // Soft delete the parent
  await prisma.parent.update({
    where: { id: parentId },
    data: {
      deletedAt: new Date(),
    },
  });
}