import { HTTPException } from 'hono/http-exception';
import {
  SUBJECT_FK,
  type ProgramCreate,
  type ProgramUpdate,
  type ProgramRead,
  type SubjectType,
  type ProgramKind,
} from '@naru/shared';
import prisma from '../db.js';

const PROGRAM_SELECT = {
  id: true,
  name: true,
  kind: true,
  subjectType: true,
  description: true,
  minAgeMonths: true,
  maxAgeMonths: true,
  visitIntervalDays: true,
  active: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  // Explicitly exclude deletedAt
} as const;

// Each kind has exactly one subject type today. subjectType is stored on the row
// anyway (SCHEMA_V2.md §6.2) so the API and UI can validate without a lookup,
// but a row whose pair disagrees with this map would break every enrollment
// written against it, so creation rejects the mismatch.
const KIND_SUBJECT_TYPE: Record<ProgramKind, SubjectType> = {
  PREGNANCY: 'MOTHER',
  NUTRITION: 'CHILD',
  MIDWIFE: 'PERSON',
  STUDENT: 'PERSON',
  FAMILY_PAF: 'FAMILY',
};

function toProgramRead(program: any): ProgramRead {
  return {
    ...program,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

/**
 * List programs. The sidebar renders active programs ordered by sortOrder
 * (WEB_DESIGN_V2.md §2), so that is the default.
 */
export async function listPrograms(options: {
  kind?: ProgramKind;
  activeOnly?: boolean;
}): Promise<{ programs: Array<ProgramRead & { activeEnrollmentCount: number }>; total: number }> {
  const where: any = {};

  if (options.kind !== undefined) where.kind = options.kind;
  if (options.activeOnly) where.active = true;

  const programs = await prisma.program.findMany({
    where,
    select: {
      ...PROGRAM_SELECT,
      _count: {
        select: { enrollments: { where: { exitedAt: null, deletedAt: null } } },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const items = programs.map(({ _count, ...program }: any) => ({
    ...toProgramRead(program),
    activeEnrollmentCount: _count.enrollments,
  }));

  return { programs: items, total: items.length };
}

/**
 * Get program by ID
 */
export async function getProgramById(programId: number): Promise<ProgramRead> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: PROGRAM_SELECT,
  });

  if (!program) {
    throw new HTTPException(404, { message: 'Program not found' });
  }

  return toProgramRead(program);
}

/**
 * Create a program. Admin only.
 */
export async function createProgram(data: ProgramCreate): Promise<ProgramRead> {
  if (KIND_SUBJECT_TYPE[data.kind] !== data.subjectType) {
    throw new HTTPException(400, {
      message: `Program kind ${data.kind} requires subjectType ${KIND_SUBJECT_TYPE[data.kind]}, got ${data.subjectType}`,
    });
  }

  assertAgeBand(data.minAgeMonths, data.maxAgeMonths);

  const program = await prisma.program.create({
    data: {
      name: data.name,
      kind: data.kind,
      subjectType: data.subjectType,
      description: data.description,
      minAgeMonths: data.minAgeMonths,
      maxAgeMonths: data.maxAgeMonths,
      visitIntervalDays: data.visitIntervalDays,
      active: data.active,
      sortOrder: data.sortOrder,
    },
    select: PROGRAM_SELECT,
  });

  return toProgramRead(program);
}

/**
 * Update a program. Admin only. kind and subjectType are immutable — the Zod
 * schema omits them, so they cannot arrive here at all.
 */
export async function updateProgram(programId: number, data: ProgramUpdate): Promise<ProgramRead> {
  const existing = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, minAgeMonths: true, maxAgeMonths: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Program not found' });
  }

  const minAgeMonths = data.minAgeMonths !== undefined ? data.minAgeMonths : existing.minAgeMonths;
  const maxAgeMonths = data.maxAgeMonths !== undefined ? data.maxAgeMonths : existing.maxAgeMonths;
  assertAgeBand(minAgeMonths, maxAgeMonths);

  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.minAgeMonths !== undefined) updateData.minAgeMonths = data.minAgeMonths;
  if (data.maxAgeMonths !== undefined) updateData.maxAgeMonths = data.maxAgeMonths;
  if (data.visitIntervalDays !== undefined) updateData.visitIntervalDays = data.visitIntervalDays;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const updated = await prisma.program.update({
    where: { id: programId },
    data: updateData,
    select: PROGRAM_SELECT,
  });

  return toProgramRead(updated);
}

/**
 * Soft delete a program. Admin only.
 *
 * Refused while active enrollments exist: the enrollment rows would survive with
 * a program that no longer lists, and every census query joins through it.
 * Deactivate (active = false) to hide a program from the sidebar instead.
 */
export async function deleteProgram(programId: number): Promise<void> {
  const existing = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Program not found' });
  }

  const activeEnrollments = await prisma.enrollment.count({
    where: { programId, exitedAt: null, deletedAt: null },
  });

  if (activeEnrollments > 0) {
    throw new HTTPException(409, {
      message: `Cannot delete a program with ${activeEnrollments} active enrollment(s). Exit them first, or set active = false to hide it.`,
    });
  }

  await prisma.program.update({
    where: { id: programId },
    data: { deletedAt: new Date() },
  });
}

/**
 * The subject FK column this program's enrollments populate.
 */
export function subjectFkFor(subjectType: SubjectType): 'motherId' | 'childId' | 'personId' | 'familyId' {
  return SUBJECT_FK[subjectType];
}

function assertAgeBand(min: number | null | undefined, max: number | null | undefined): void {
  if (min != null && max != null && max < min) {
    throw new HTTPException(400, {
      message: 'maxAgeMonths must be greater than or equal to minAgeMonths',
    });
  }
}
