import { HTTPException } from 'hono/http-exception';
import {
  type BirthingAssistantCreate,
  type BirthingAssistantUpdate,
  type BirthingAssistantRead,
  type UserRead
} from '@naru/shared';
import prisma from '../db.js';

/**
 * List all birthing assistants with communities and trainings
 */
export async function listBirthingAssistants(): Promise<BirthingAssistantRead[]> {
  const birthingAssistants = await prisma.birthingAssistant.findMany({
    include: {
      // The soft-delete extension only filters top-level `where` clauses, so a
      // junction row pointing at a soft-deleted community/training would still
      // come back. Filter on the related row explicitly.
      servedCommunities: {
        where: { community: { deletedAt: null } },
        include: {
          community: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      trainingsReceived: {
        where: { training: { deletedAt: null } },
        include: {
          training: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return birthingAssistants.map((ba: any) => ({
    id: ba.id,
    localId: ba.localId,
    name: ba.name,
    createdAt: ba.createdAt.toISOString(),
    updatedAt: ba.updatedAt.toISOString(),
    servedCommunities: ba.servedCommunities.map((sc: any) => ({
      id: sc.community.id,
      title: sc.community.title,
    })),
    trainingsReceived: ba.trainingsReceived.map((tr: any) => ({
      id: tr.training.id,
      title: tr.training.title,
    })),
  }));
}

/**
 * Create a new birthing assistant with community and training associations
 */
export async function createBirthingAssistant(data: BirthingAssistantCreate): Promise<BirthingAssistantRead> {
  // Check if localId already exists
  if (data.localId) {
    const existing = await prisma.birthingAssistant.findUnique({
      where: { localId: data.localId },
    });
    if (existing) {
      throw new HTTPException(400, { message: 'Birthing assistant with this localId already exists' });
    }
  }

  // Verify that communities exist
  if (data.communityIds && data.communityIds.length > 0) {
    const communities = await prisma.community.findMany({
      where: {
        id: { in: data.communityIds },
        deletedAt: null,
      },
    });
    if (communities.length !== data.communityIds.length) {
      throw new HTTPException(400, { message: 'One or more communities do not exist' });
    }
  }

  // Verify that trainings exist
  if (data.trainingIds && data.trainingIds.length > 0) {
    const trainings = await prisma.training.findMany({
      where: {
        id: { in: data.trainingIds },
        deletedAt: null,
      },
    });
    if (trainings.length !== data.trainingIds.length) {
      throw new HTTPException(400, { message: 'One or more trainings do not exist' });
    }
  }

  // Create the birthing assistant with associations
  const birthingAssistant = await prisma.birthingAssistant.create({
    data: {
      name: data.name,
      localId: data.localId,
      servedCommunities: {
        create: (data.communityIds || []).map(communityId => ({
          communityId,
        })),
      },
      trainingsReceived: {
        create: (data.trainingIds || []).map(trainingId => ({
          trainingId,
        })),
      },
    },
    include: {
      // The soft-delete extension only filters top-level `where` clauses, so a
      // junction row pointing at a soft-deleted community/training would still
      // come back. Filter on the related row explicitly.
      servedCommunities: {
        where: { community: { deletedAt: null } },
        include: {
          community: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      trainingsReceived: {
        where: { training: { deletedAt: null } },
        include: {
          training: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  return {
    id: birthingAssistant.id,
    localId: birthingAssistant.localId,
    name: birthingAssistant.name,
    createdAt: birthingAssistant.createdAt.toISOString(),
    updatedAt: birthingAssistant.updatedAt.toISOString(),
    servedCommunities: birthingAssistant.servedCommunities.map((sc: any) => ({
      id: sc.community.id,
      title: sc.community.title,
    })),
    trainingsReceived: birthingAssistant.trainingsReceived.map((tr: any) => ({
      id: tr.training.id,
      title: tr.training.title,
    })),
  };
}

/**
 * Get birthing assistant by ID
 */
export async function getBirthingAssistantById(id: number): Promise<BirthingAssistantRead> {
  const birthingAssistant = await prisma.birthingAssistant.findUnique({
    where: { id },
    include: {
      // The soft-delete extension only filters top-level `where` clauses, so a
      // junction row pointing at a soft-deleted community/training would still
      // come back. Filter on the related row explicitly.
      servedCommunities: {
        where: { community: { deletedAt: null } },
        include: {
          community: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      trainingsReceived: {
        where: { training: { deletedAt: null } },
        include: {
          training: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!birthingAssistant) {
    throw new HTTPException(404, { message: 'Birthing assistant not found' });
  }

  return {
    id: birthingAssistant.id,
    localId: birthingAssistant.localId,
    name: birthingAssistant.name,
    createdAt: birthingAssistant.createdAt.toISOString(),
    updatedAt: birthingAssistant.updatedAt.toISOString(),
    servedCommunities: birthingAssistant.servedCommunities.map((sc: any) => ({
      id: sc.community.id,
      title: sc.community.title,
    })),
    trainingsReceived: birthingAssistant.trainingsReceived.map((tr: any) => ({
      id: tr.training.id,
      title: tr.training.title,
    })),
  };
}

/**
 * Update birthing assistant by ID with community and training associations
 */
export async function updateBirthingAssistant(id: number, data: BirthingAssistantUpdate): Promise<BirthingAssistantRead> {
  // Check if birthing assistant exists
  const existing = await prisma.birthingAssistant.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Birthing assistant not found' });
  }

  // Check if localId already exists (excluding current record)
  if (data.localId) {
    const existingWithLocalId = await prisma.birthingAssistant.findFirst({
      where: {
        localId: data.localId,
        id: { not: id },
      },
    });
    if (existingWithLocalId) {
      throw new HTTPException(400, { message: 'Birthing assistant with this localId already exists' });
    }
  }

  // Verify that communities exist if provided
  if (data.communityIds && data.communityIds.length > 0) {
    const communities = await prisma.community.findMany({
      where: {
        id: { in: data.communityIds },
        deletedAt: null,
      },
    });
    if (communities.length !== data.communityIds.length) {
      throw new HTTPException(400, { message: 'One or more communities do not exist' });
    }
  }

  // Verify that trainings exist if provided
  if (data.trainingIds && data.trainingIds.length > 0) {
    const trainings = await prisma.training.findMany({
      where: {
        id: { in: data.trainingIds },
        deletedAt: null,
      },
    });
    if (trainings.length !== data.trainingIds.length) {
      throw new HTTPException(400, { message: 'One or more trainings do not exist' });
    }
  }

  // Prepare update data
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.localId !== undefined) updateData.localId = data.localId;

  // Update the birthing assistant with associations
  const birthingAssistant = await prisma.birthingAssistant.update({
    where: { id },
    data: {
      ...updateData,
      servedCommunities: data.communityIds !== undefined ? {
        deleteMany: {}, // Remove all existing associations
        create: data.communityIds.map(communityId => ({
          communityId,
        })),
      } : undefined,
      trainingsReceived: data.trainingIds !== undefined ? {
        deleteMany: {}, // Remove all existing associations
        create: data.trainingIds.map(trainingId => ({
          trainingId,
        })),
      } : undefined,
    },
    include: {
      // The soft-delete extension only filters top-level `where` clauses, so a
      // junction row pointing at a soft-deleted community/training would still
      // come back. Filter on the related row explicitly.
      servedCommunities: {
        where: { community: { deletedAt: null } },
        include: {
          community: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      trainingsReceived: {
        where: { training: { deletedAt: null } },
        include: {
          training: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  return {
    id: birthingAssistant.id,
    localId: birthingAssistant.localId,
    name: birthingAssistant.name,
    createdAt: birthingAssistant.createdAt.toISOString(),
    updatedAt: birthingAssistant.updatedAt.toISOString(),
    servedCommunities: birthingAssistant.servedCommunities.map((sc: any) => ({
      id: sc.community.id,
      title: sc.community.title,
    })),
    trainingsReceived: birthingAssistant.trainingsReceived.map((tr: any) => ({
      id: tr.training.id,
      title: tr.training.title,
    })),
  };
}

/**
 * Soft delete birthing assistant by ID
 */
export async function deleteBirthingAssistant(id: number): Promise<void> {
  const existing = await prisma.birthingAssistant.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Birthing assistant not found' });
  }

  await prisma.birthingAssistant.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}