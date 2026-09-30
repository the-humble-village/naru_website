import { HTTPException } from 'hono/http-exception';
import {
  type MotherCreate,
  type MotherUpdate,
  type MotherRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

const MOTHER_SELECT = {
  id: true,
  localId: true,
  name: true,
  birthDate: true,
  communityId: true,
  phone: true,
  familyId: true,
  midwifeId: true,
  pregnancies: true,
  childrenCount: true,
  breastfedCount: true,
  malnutritionDeaths: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // Explicitly exclude deletedAt
} as const;

function toMotherRead(mother: any): MotherRead {
  return {
    ...mother,
    birthDate: mother.birthDate ? mother.birthDate.toISOString() : null,
    createdAt: mother.createdAt.toISOString(),
    updatedAt: mother.updatedAt.toISOString(),
  };
}

/**
 * List mothers, optionally filtered by family, midwife, community, or enrollment state
 */
export async function listMothers(options: {
  familyId?: number;
  midwifeId?: number;
  communityId?: number;
  siteId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ mothers: MotherRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};

  if (options.familyId !== undefined) where.familyId = options.familyId;
  if (options.midwifeId !== undefined) where.midwifeId = options.midwifeId;
  if (options.communityId !== undefined) where.communityId = options.communityId;

  // Site is a rollup of Community — a subject stores only communityId, so a site
  // filter has to go through the relation (SCHEMA_V2.md §6.7).
  if (options.siteId !== undefined) where.community = { siteId: options.siteId };

  if (options.search && options.search.trim()) {
    where.name = { contains: options.search.trim(), mode: 'insensitive' };
  }

  // "Unenrolled" needs no schema support — it is zero active enrollment rows
  // (SCHEMA_V2.md §9.4).
  if (options.unenrolled) {
    where.enrollments = {
      none: { exitedAt: null, deletedAt: null },
    };
  }

  const [mothers, total] = await Promise.all([
    prisma.mother.findMany({
      where,
      skip,
      take: limit,
      select: MOTHER_SELECT,
      orderBy: { name: 'asc' },
    }),
    prisma.mother.count({ where }),
  ]);

  return { mothers: mothers.map(toMotherRead), total };
}

/**
 * Create a new mother. familyId, communityId and midwifeId are all optional.
 */
export async function createMother(data: MotherCreate): Promise<MotherRead> {
  await assertRelations(data);

  if (data.localId) {
    const existing = await prisma.mother.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existing) {
      throw new HTTPException(400, { message: 'Mother with this localId already exists' });
    }
  }

  const mother = await prisma.mother.create({
    data: {
      name: data.name,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      communityId: data.communityId,
      phone: data.phone,
      familyId: data.familyId,
      midwifeId: data.midwifeId,
      pregnancies: data.pregnancies,
      childrenCount: data.childrenCount,
      breastfedCount: data.breastfedCount,
      malnutritionDeaths: data.malnutritionDeaths,
      notes: data.notes,
      localId: data.localId,
    },
    select: MOTHER_SELECT,
  });

  return toMotherRead(mother);
}

/**
 * Get mother by ID
 */
export async function getMotherById(motherId: number, user: UserRead): Promise<MotherRead> {
  const mother = await prisma.mother.findUnique({
    where: { id: motherId },
    select: MOTHER_SELECT,
  });

  if (!mother) {
    throw new HTTPException(404, { message: 'Mother not found' });
  }

  return toMotherRead(mother);
}

/**
 * Update mother by ID
 */
export async function updateMother(
  motherId: number,
  data: MotherUpdate,
  user: UserRead
): Promise<MotherRead> {
  const existing = await prisma.mother.findUnique({
    where: { id: motherId },
    select: { id: true, localId: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Mother not found' });
  }

  await assertRelations(data);

  if (data.localId && data.localId !== existing.localId) {
    const localIdExists = await prisma.mother.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Mother with this localId already exists' });
    }
  }

  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  }
  if (data.communityId !== undefined) updateData.communityId = data.communityId;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.familyId !== undefined) updateData.familyId = data.familyId;
  if (data.midwifeId !== undefined) updateData.midwifeId = data.midwifeId;
  if (data.pregnancies !== undefined) updateData.pregnancies = data.pregnancies;
  if (data.childrenCount !== undefined) updateData.childrenCount = data.childrenCount;
  if (data.breastfedCount !== undefined) updateData.breastfedCount = data.breastfedCount;
  if (data.malnutritionDeaths !== undefined) {
    updateData.malnutritionDeaths = data.malnutritionDeaths;
  }
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  const updated = await prisma.mother.update({
    where: { id: motherId },
    data: updateData,
    select: MOTHER_SELECT,
  });

  return toMotherRead(updated);
}

/**
 * Delete mother by ID (soft delete). Supervisor+ only.
 */
export async function deleteMother(motherId: number, user: UserRead): Promise<void> {
  const existing = await prisma.mother.findUnique({
    where: { id: motherId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Mother not found' });
  }

  await prisma.mother.update({
    where: { id: motherId },
    data: { deletedAt: new Date() },
  });
}

async function assertRelations(data: MotherCreate | MotherUpdate): Promise<void> {
  if (data.familyId) {
    const family = await prisma.family.findFirst({
      where: { id: data.familyId, deletedAt: null },
      select: { id: true },
    });

    if (!family) {
      throw new HTTPException(404, { message: 'Family not found' });
    }
  }

  if (data.communityId) {
    const community = await prisma.community.findFirst({
      where: { id: data.communityId, deletedAt: null },
      select: { id: true },
    });

    if (!community) {
      throw new HTTPException(404, { message: 'Community not found' });
    }
  }

  // A midwife is a Person (SCHEMA_V2.md §2) — never a BirthingAssistant.
  if (data.midwifeId) {
    const midwife = await prisma.person.findFirst({
      where: { id: data.midwifeId, deletedAt: null },
      select: { id: true },
    });

    if (!midwife) {
      throw new HTTPException(404, { message: 'Midwife not found' });
    }
  }
}
