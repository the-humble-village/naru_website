import { HTTPException } from 'hono/http-exception';
import {
  SUBJECT_FK,
  KIND_ENROLLMENT_DETAIL,
  type EnrollmentCreate,
  type EnrollmentUpdate,
  type EnrollmentExit,
  type EnrollmentRead,
  type EnrollmentListItem,
  type ProgramKind,
  type SubjectType,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly, toDecimal } from '../utils/date.js';

type SubjectFk = 'motherId' | 'childId' | 'personId' | 'familyId';

const ENROLLMENT_SELECT = {
  id: true,
  localId: true,
  programId: true,
  motherId: true,
  childId: true,
  personId: true,
  familyId: true,
  enrolledAt: true,
  entryWeight: true,
  entryPhotoId: true,
  admissionNotes: true,
  exitedAt: true,
  exitReason: true,
  exitWeight: true,
  exitPhotoId: true,
  exitNotes: true,
  createdAt: true,
  updatedAt: true,
  pregnancyDetail: {
    select: { dueDate: true, pregnancyNumber: true, birthingAssistantId: true },
  },
  nutritionDetail: {
    select: {
      lengthAtAdmission: true,
      caretakerName: true,
      caretakerPhone: true,
      nutritionalStatus: true,
    },
  },
  studentDetail: {
    select: { school: true, classYear: true },
  },
  // Explicitly exclude deletedAt
} as const;

function toEnrollmentRead(row: any): EnrollmentRead {
  return {
    id: row.id,
    localId: row.localId,
    programId: row.programId,
    motherId: row.motherId,
    childId: row.childId,
    personId: row.personId,
    familyId: row.familyId,
    enrolledAt: toDateOnly(row.enrolledAt)!,
    entryWeight: toDecimal(row.entryWeight),
    entryPhotoId: row.entryPhotoId,
    admissionNotes: row.admissionNotes,
    exitedAt: toDateOnly(row.exitedAt),
    exitReason: row.exitReason,
    exitWeight: toDecimal(row.exitWeight),
    exitPhotoId: row.exitPhotoId,
    exitNotes: row.exitNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pregnancyDetail: row.pregnancyDetail
      ? { ...row.pregnancyDetail, dueDate: toDateOnly(row.pregnancyDetail.dueDate) }
      : null,
    nutritionDetail: row.nutritionDetail ?? null,
    studentDetail: row.studentDetail ?? null,
  };
}

/**
 * List enrollments.
 *
 * `status` maps the two definitions in SCHEMA_V2.md §6.2: 'active' is
 * `exitedAt IS NULL`, and `onDate` is the census filter
 * `enrolledAt <= D AND (exitedAt IS NULL OR exitedAt > D)`.
 */
export async function listEnrollments(options: {
  programId?: number;
  motherId?: number;
  childId?: number;
  personId?: number;
  familyId?: number;
  status?: 'active' | 'exited' | 'all';
  onDate?: string;
  communityId?: number;
  siteId?: number;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ enrollments: EnrollmentListItem[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};

  if (options.programId !== undefined) where.programId = options.programId;
  if (options.motherId !== undefined) where.motherId = options.motherId;
  if (options.childId !== undefined) where.childId = options.childId;
  if (options.personId !== undefined) where.personId = options.personId;
  if (options.familyId !== undefined) where.familyId = options.familyId;

  const status = options.status ?? 'active';
  if (status === 'active') where.exitedAt = null;
  if (status === 'exited') where.exitedAt = { not: null };

  if (options.onDate) {
    where.enrolledAt = { lte: new Date(options.onDate) };
    where.OR = [{ exitedAt: null }, { exitedAt: { gt: new Date(options.onDate) } }];
  }

  // Community lives on the subject, and site is a rollup of community
  // (SCHEMA_V2.md §6.7) — neither is stored on the enrollment, so both filters
  // fan out across the four subject relations.
  const subjectFilter = buildSubjectLocationFilter(options.communityId, options.siteId);
  if (subjectFilter) {
    where.AND = [...(where.AND ?? []), subjectFilter];
  }

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take: limit,
      select: {
        ...ENROLLMENT_SELECT,
        program: { select: { id: true, name: true, kind: true, subjectType: true } },
        mother: { select: { name: true } },
        child: { select: { name: true } },
        person: { select: { name: true } },
        family: { select: { familyName: true } },
        // The soft-delete extension only rewrites the top-level where, so the
        // nested visit filters below are spelled out.
        _count: { select: { visits: { where: { deletedAt: null } } } },
        visits: {
          where: { deletedAt: null },
          orderBy: { visitDate: 'desc' },
          take: 1,
          select: { visitDate: true },
        },
      },
      orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.enrollment.count({ where }),
  ]);

  const enrollments = rows.map((row: any) => {
    const { program, mother, child, person, family, _count, visits, ...rest } = row;

    return {
      ...toEnrollmentRead(rest),
      program,
      subjectName:
        mother?.name ?? child?.name ?? person?.name ?? family?.familyName ?? null,
      visitCount: _count.visits,
      lastVisitDate: visits.length > 0 ? toDateOnly(visits[0].visitDate) : null,
    };
  });

  return { enrollments, total };
}

/**
 * Get enrollment by ID
 */
export async function getEnrollmentById(
  enrollmentId: number,
  user: UserRead
): Promise<EnrollmentRead> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: ENROLLMENT_SELECT,
  });

  if (!enrollment) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  return toEnrollmentRead(enrollment);
}

/**
 * Enrol a subject in a program.
 *
 * Zod has already checked that exactly one subject FK is populated. This adds
 * the three rules the database cannot express (SCHEMA_V2.md §7.5): the FK must
 * match the program's subjectType, the subject row must exist, and the detail
 * block must match the program's kind.
 */
export async function createEnrollment(data: EnrollmentCreate): Promise<EnrollmentRead> {
  const program = await prisma.program.findFirst({
    where: { id: data.programId, deletedAt: null },
    select: { id: true, kind: true, subjectType: true, active: true },
  });

  if (!program) {
    throw new HTTPException(404, { message: 'Program not found' });
  }

  if (!program.active) {
    throw new HTTPException(400, { message: 'Cannot enrol in an inactive program' });
  }

  const expectedFk = SUBJECT_FK[program.subjectType as SubjectType];
  const populatedFk = (['motherId', 'childId', 'personId', 'familyId'] as const).find(
    (key) => data[key] !== undefined && data[key] !== null
  ) as SubjectFk;

  if (populatedFk !== expectedFk) {
    throw new HTTPException(400, {
      message: `Program expects a ${program.subjectType} subject (${expectedFk}), got ${populatedFk}`,
    });
  }

  const subjectId = data[expectedFk]!;
  await assertSubjectExists(program.subjectType as SubjectType, subjectId);

  const detail = assertDetailMatchesKind(program.kind as ProgramKind, data);

  await assertPhotoExists(data.entryPhotoId);

  if (data.localId) {
    const existing = await prisma.enrollment.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existing) {
      throw new HTTPException(400, { message: 'Enrollment with this localId already exists' });
    }
  }

  if (detail.kind === 'pregnancy' && detail.value?.birthingAssistantId) {
    const ba = await prisma.birthingAssistant.findFirst({
      where: { id: detail.value.birthingAssistantId, deletedAt: null },
      select: { id: true },
    });

    if (!ba) {
      throw new HTTPException(404, { message: 'Birthing assistant not found' });
    }
  }

  try {
    const created = await prisma.enrollment.create({
      data: {
        programId: data.programId,
        [expectedFk]: subjectId,
        enrolledAt: new Date(data.enrolledAt),
        entryWeight: data.entryWeight,
        entryPhotoId: data.entryPhotoId,
        admissionNotes: data.admissionNotes,
        localId: data.localId,
        ...(detail.kind === 'pregnancy' && detail.value
          ? {
              pregnancyDetail: {
                create: {
                  ...detail.value,
                  dueDate: detail.value.dueDate ? new Date(detail.value.dueDate) : null,
                },
              },
            }
          : {}),
        ...(detail.kind === 'nutrition' && detail.value
          ? { nutritionDetail: { create: detail.value } }
          : {}),
        ...(detail.kind === 'student' && detail.value
          ? { studentDetail: { create: detail.value } }
          : {}),
      },
      select: ENROLLMENT_SELECT,
    });

    return toEnrollmentRead(created);
  } catch (error: any) {
    throw translateActiveEnrollmentConflict(error, program.subjectType as SubjectType);
  }
}

/**
 * Update an enrollment's admission data. The subject and the program are
 * immutable, and exiting goes through exitEnrollment.
 */
export async function updateEnrollment(
  enrollmentId: number,
  data: EnrollmentUpdate,
  user: UserRead
): Promise<EnrollmentRead> {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      exitedAt: true,
      enrolledAt: true,
      program: { select: { kind: true } },
    },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  const detail = assertDetailMatchesKind(existing.program.kind as ProgramKind, data);

  await assertPhotoExists(data.entryPhotoId);

  // enrolledAt cannot move past an existing exit — the enrollment_exit_after_entry
  // CHECK would reject it, and a 500 from Postgres is a worse answer than this.
  if (data.enrolledAt !== undefined && existing.exitedAt) {
    if (new Date(data.enrolledAt) > existing.exitedAt) {
      throw new HTTPException(400, {
        message: 'Admission date cannot be later than the exit date',
      });
    }
  }

  const updateData: any = { updatedAt: new Date() };

  if (data.enrolledAt !== undefined) updateData.enrolledAt = new Date(data.enrolledAt);
  if (data.entryWeight !== undefined) updateData.entryWeight = data.entryWeight;
  if (data.entryPhotoId !== undefined) updateData.entryPhotoId = data.entryPhotoId;
  if (data.admissionNotes !== undefined) updateData.admissionNotes = data.admissionNotes;

  if (detail.kind === 'pregnancy' && detail.value) {
    const payload = {
      ...detail.value,
      dueDate: detail.value.dueDate ? new Date(detail.value.dueDate) : null,
    };
    updateData.pregnancyDetail = { upsert: { create: payload, update: payload } };
  }

  if (detail.kind === 'nutrition' && detail.value) {
    updateData.nutritionDetail = {
      upsert: { create: detail.value, update: detail.value },
    };
  }

  if (detail.kind === 'student' && detail.value) {
    updateData.studentDetail = { upsert: { create: detail.value, update: detail.value } };
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: updateData,
    select: ENROLLMENT_SELECT,
  });

  return toEnrollmentRead(updated);
}

/**
 * Exit a subject from a program. Separate from update because exitedAt and
 * exitReason travel together and the pair is what ends the enrollment.
 */
export async function exitEnrollment(
  enrollmentId: number,
  data: EnrollmentExit,
  user: UserRead
): Promise<EnrollmentRead> {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, enrolledAt: true, exitedAt: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  if (existing.exitedAt) {
    throw new HTTPException(409, { message: 'Enrollment has already been exited' });
  }

  const exitedAt = new Date(data.exitedAt);

  if (exitedAt < existing.enrolledAt) {
    throw new HTTPException(400, {
      message: 'Exit date cannot be earlier than the admission date',
    });
  }

  await assertPhotoExists(data.exitPhotoId);

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      exitedAt,
      exitReason: data.exitReason,
      exitWeight: data.exitWeight,
      exitPhotoId: data.exitPhotoId,
      exitNotes: data.exitNotes,
      updatedAt: new Date(),
    },
    select: ENROLLMENT_SELECT,
  });

  return toEnrollmentRead(updated);
}

/**
 * Undo an exit, returning the enrollment to active. Supervisor+ only —
 * workers will mis-click DIED (WEB_DESIGN_V2.md §12.9).
 *
 * This can collide with the one-active-enrollment-per-program index if the
 * subject has since been re-enrolled, which is why the conflict is translated.
 */
export async function reopenEnrollment(
  enrollmentId: number,
  user: UserRead
): Promise<EnrollmentRead> {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      exitedAt: true,
      program: { select: { subjectType: true } },
    },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  if (!existing.exitedAt) {
    throw new HTTPException(409, { message: 'Enrollment is already active' });
  }

  try {
    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        exitedAt: null,
        exitReason: null,
        exitWeight: null,
        exitPhotoId: null,
        exitNotes: null,
        updatedAt: new Date(),
      },
      select: ENROLLMENT_SELECT,
    });

    return toEnrollmentRead(updated);
  } catch (error: any) {
    throw translateActiveEnrollmentConflict(
      error,
      existing.program.subjectType as SubjectType,
      'This subject already has a different active enrollment in this program'
    );
  }
}

/**
 * Soft delete an enrollment. Supervisor+ only.
 */
export async function deleteEnrollment(enrollmentId: number, user: UserRead): Promise<void> {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { deletedAt: new Date() },
  });
}

type DetailBlock =
  | { kind: 'pregnancy'; value?: any }
  | { kind: 'nutrition'; value?: any }
  | { kind: 'student'; value?: any }
  | { kind: null; value?: undefined };

/**
 * A PREGNANCY enrollment may only carry a PregnancyEnrollmentDetail, and
 * MIDWIFE / FAMILY_PAF carry none at all (SCHEMA_V2.md §7.5).
 */
function assertDetailMatchesKind(
  kind: ProgramKind,
  data: { pregnancyDetail?: any; nutritionDetail?: any; studentDetail?: any }
): DetailBlock {
  const allowed = KIND_ENROLLMENT_DETAIL[kind];

  const supplied = (['pregnancy', 'nutrition', 'student'] as const).filter(
    (name) => data[`${name}Detail` as const] !== undefined
  );

  const disallowed = supplied.filter((name) => name !== allowed);

  if (disallowed.length > 0) {
    throw new HTTPException(400, {
      message: allowed
        ? `Program kind ${kind} accepts only ${allowed}Detail, got ${disallowed.map((n) => `${n}Detail`).join(', ')}`
        : `Program kind ${kind} accepts no enrollment detail, got ${disallowed.map((n) => `${n}Detail`).join(', ')}`,
    });
  }

  if (!allowed) return { kind: null };

  return { kind: allowed, value: data[`${allowed}Detail` as const] } as DetailBlock;
}

async function assertSubjectExists(subjectType: SubjectType, subjectId: number): Promise<void> {
  const model = {
    MOTHER: 'mother',
    CHILD: 'child',
    PERSON: 'person',
    FAMILY: 'family',
  }[subjectType];

  const row = await (prisma as any)[model].findFirst({
    where: { id: subjectId, deletedAt: null },
    select: { id: true },
  });

  if (!row) {
    throw new HTTPException(404, {
      message: `${subjectType.charAt(0)}${subjectType.slice(1).toLowerCase()} not found`,
    });
  }
}

async function assertPhotoExists(fileId: number | null | undefined): Promise<void> {
  if (!fileId) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, deletedAt: null },
    select: { id: true },
  });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }
}

function buildSubjectLocationFilter(
  communityId: number | undefined,
  siteId: number | undefined
): any | null {
  if (communityId === undefined && siteId === undefined) return null;

  const match: any = {};
  if (communityId !== undefined) match.communityId = communityId;
  if (siteId !== undefined) match.community = { siteId };

  return {
    OR: [
      { mother: match },
      { child: match },
      { person: match },
      { family: match },
    ],
  };
}

/**
 * P2002 here is one of the four `enrollment_one_active_*` partial unique indexes
 * (SCHEMA_V2.md §7.2). Anything else is a genuine failure and is rethrown.
 */
function translateActiveEnrollmentConflict(
  error: any,
  subjectType: SubjectType,
  message?: string
): any {
  if (error?.code === 'P2002') {
    return new HTTPException(409, {
      message:
        message ??
        `This ${subjectType.toLowerCase()} already has an active enrollment in this program`,
    });
  }

  return error;
}
