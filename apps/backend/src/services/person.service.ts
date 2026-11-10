import { HTTPException } from 'hono/http-exception';
import {
  type PersonCreate,
  type PersonUpdate,
  type PersonRead,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

const PERSON_SELECT = {
  id: true,
  localId: true,
  name: true,
  birthDate: true,
  sex: true,
  communityId: true,
  phone: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // Explicitly exclude deletedAt
} as const;

function toPersonRead(person: any): PersonRead {
  return {
    ...person,
    birthDate: person.birthDate ? person.birthDate.toISOString() : null,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}

/**
 * List people, optionally filtered by community, program or enrollment state.
 *
 * `programId` is how the UI lists midwives: a midwife is a Person with an active
 * enrollment in a MIDWIFE-kind program (SCHEMA_V2.md §2).
 */
export async function listPeople(options: {
  communityId?: number;
  siteId?: number;
  programId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ people: PersonRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};

  if (options.communityId !== undefined) where.communityId = options.communityId;

  // Site is a rollup of Community — a subject stores only communityId, so a site
  // filter has to go through the relation (SCHEMA_V2.md §6.7).
  if (options.siteId !== undefined) where.community = { siteId: options.siteId };

  if (options.search && options.search.trim()) {
    where.name = { contains: options.search.trim(), mode: 'insensitive' };
  }

  if (options.programId !== undefined) {
    where.enrollments = {
      some: { programId: options.programId, exitedAt: null, deletedAt: null },
    };
  }

  if (options.unenrolled) {
    where.enrollments = {
      none: { exitedAt: null, deletedAt: null },
    };
  }

  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      skip,
      take: limit,
      select: PERSON_SELECT,
      orderBy: { name: 'asc' },
    }),
    prisma.person.count({ where }),
  ]);

  return { people: people.map(toPersonRead), total };
}

/**
 * Create a new person
 */
export async function createPerson(data: PersonCreate): Promise<PersonRead> {
  await assertCommunity(data.communityId);

  if (data.localId) {
    const existing = await prisma.person.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existing) {
      throw new HTTPException(400, { message: 'Person with this localId already exists' });
    }
  }

  const person = await prisma.person.create({
    data: {
      name: data.name,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      sex: data.sex,
      communityId: data.communityId,
      phone: data.phone,
      notes: data.notes,
      localId: data.localId,
    },
    select: PERSON_SELECT,
  });

  return toPersonRead(person);
}

/**
 * Get person by ID
 */
export async function getPersonById(personId: number, user: UserRead): Promise<PersonRead> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: PERSON_SELECT,
  });

  if (!person) {
    throw new HTTPException(404, { message: 'Person not found' });
  }

  return toPersonRead(person);
}

/**
 * Update person by ID
 */
export async function updatePerson(
  personId: number,
  data: PersonUpdate,
  user: UserRead
): Promise<PersonRead> {
  const existing = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, localId: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Person not found' });
  }

  await assertCommunity(data.communityId);

  if (data.localId && data.localId !== existing.localId) {
    const localIdExists = await prisma.person.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (localIdExists) {
      throw new HTTPException(400, { message: 'Person with this localId already exists' });
    }
  }

  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  }
  if (data.sex !== undefined) updateData.sex = data.sex;
  if (data.communityId !== undefined) updateData.communityId = data.communityId;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.localId !== undefined) updateData.localId = data.localId;

  const updated = await prisma.person.update({
    where: { id: personId },
    data: updateData,
    select: PERSON_SELECT,
  });

  return toPersonRead(updated);
}

/**
 * Delete person by ID (soft delete). Supervisor+ only.
 */
export async function deletePerson(personId: number, user: UserRead): Promise<void> {
  const existing = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Person not found' });
  }

  await prisma.person.update({
    where: { id: personId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Mothers this person accompanies as a midwife. This is the caseload view that
 * `mother.midwifeId` exists to serve (WEB_DESIGN_V2.md §6).
 */
export async function listAssignedMothers(
  personId: number
): Promise<Array<{ id: number; name: string; communityId: number | null }>> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true },
  });

  if (!person) {
    throw new HTTPException(404, { message: 'Person not found' });
  }

  return prisma.mother.findMany({
    where: { midwifeId: personId },
    select: { id: true, name: true, communityId: true },
    orderBy: { name: 'asc' },
  });
}

async function assertCommunity(communityId: number | null | undefined): Promise<void> {
  if (!communityId) return;

  const community = await prisma.community.findFirst({
    where: { id: communityId, deletedAt: null },
    select: { id: true },
  });

  if (!community) {
    throw new HTTPException(404, { message: 'Community not found' });
  }
}
