import { HTTPException } from 'hono/http-exception';
import {
  KIND_VISIT_DETAIL,
  ageInDays,
  computeNutritionZScores,
  type NutritionZScores,
  type ProgramKind,
  type Sex,
  type UserRead,
  type VisitCreate,
  type VisitUpdate,
  type VisitRead,
  type VisitListItem,
  type VisitPrefill,
} from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly, toDecimal } from '../utils/date.js';

const VISIT_SELECT = {
  id: true,
  localId: true,
  enrollmentId: true,
  visitDate: true,
  locationType: true,
  siteId: true,
  communityId: true,
  recordedById: true,
  eventId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  resources: { select: { resourceId: true, quantity: true, unit: true } },
  trainings: { select: { trainingId: true } },
  answers: {
    select: { questionId: true, valueText: true, valueNum: true, valueBool: true },
  },
  pregnancyDetail: {
    select: { weight: true, gestationMonths: true, examinationTypeId: true },
  },
  nutritionDetail: {
    select: {
      weight: true,
      height: true,
      armCircumference: true,
      weightForAgeZ: true,
      heightForAgeZ: true,
      weightForHeightZ: true,
      muacZ: true,
      nutritionalStatus: true,
    },
  },
  // Explicitly exclude deletedAt
} as const;

function toVisitRead(row: any): VisitRead {
  return {
    id: row.id,
    localId: row.localId,
    enrollmentId: row.enrollmentId,
    visitDate: toDateOnly(row.visitDate)!,
    locationType: row.locationType,
    siteId: row.siteId,
    communityId: row.communityId,
    recordedById: row.recordedById,
    eventId: row.eventId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resources: row.resources.map((entry: any) => ({
      resourceId: entry.resourceId,
      quantity: toDecimal(entry.quantity) ?? 0,
      unit: entry.unit,
    })),
    trainingIds: row.trainings.map((entry: any) => entry.trainingId),
    answers: row.answers.map((entry: any) => ({
      questionId: entry.questionId,
      valueText: entry.valueText,
      valueNum: toDecimal(entry.valueNum),
      valueBool: entry.valueBool,
    })),
    pregnancyDetail: row.pregnancyDetail
      ? { ...row.pregnancyDetail, weight: toDecimal(row.pregnancyDetail.weight) }
      : null,
    nutritionDetail: row.nutritionDetail
      ? {
          weight: toDecimal(row.nutritionDetail.weight),
          height: row.nutritionDetail.height,
          armCircumference: row.nutritionDetail.armCircumference,
          weightForAgeZ: toDecimal(row.nutritionDetail.weightForAgeZ),
          heightForAgeZ: toDecimal(row.nutritionDetail.heightForAgeZ),
          weightForHeightZ: toDecimal(row.nutritionDetail.weightForHeightZ),
          muacZ: toDecimal(row.nutritionDetail.muacZ),
          nutritionalStatus: row.nutritionDetail.nutritionalStatus,
        }
      : null,
  };
}

/**
 * List visits.
 *
 * `siteId` and `communityId` filter on where the visit *happened*, not where the
 * subject lives — a mobile clinic is counted where it occurred (SCHEMA_V2.md §6.5).
 */
export async function listVisits(options: {
  search?: string;
  enrollmentId?: number;
  programId?: number;
  siteId?: number;
  communityId?: number;
  eventId?: number;
  recordedById?: number;
  from?: string;
  to?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ visits: VisitListItem[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  // Soft-deleting an enrollment does not cascade to its visits, so the join is
  // filtered here or a deleted enrollment's visits keep showing up in reports.
  const where: any = { enrollment: { deletedAt: null } };

  if (options.enrollmentId !== undefined) where.enrollmentId = options.enrollmentId;
  if (options.programId !== undefined) where.enrollment.programId = options.programId;
  if (options.siteId !== undefined) where.siteId = options.siteId;
  if (options.communityId !== undefined) where.communityId = options.communityId;
  if (options.eventId !== undefined) where.eventId = options.eventId;
  if (options.recordedById !== undefined) where.recordedById = options.recordedById;

  // Apply name search before counting and pagination, across all subject types.
  const searchTerms = options.search?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (searchTerms.length > 0) {
    where.enrollment.AND = searchTerms.map(term => {
      const name = { contains: term.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
      return {
        OR: [
          { mother: { name } },
          { child: { name } },
          { person: { name } },
          { family: { familyName: name } },
        ],
      };
    });
  }

  if (options.from !== undefined || options.to !== undefined) {
    where.visitDate = {};
    if (options.from !== undefined) where.visitDate.gte = new Date(options.from);
    if (options.to !== undefined) where.visitDate.lte = new Date(options.to);
  }

  const [rows, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      select: {
        ...VISIT_SELECT,
        enrollment: {
          select: {
            program: { select: { id: true, name: true, kind: true, subjectType: true } },
            mother: { select: { name: true } },
            child: { select: { name: true } },
            person: { select: { name: true } },
            family: { select: { familyName: true } },
          },
        },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ visitDate: 'desc' }, { id: 'desc' }],
    }),
    prisma.visit.count({ where }),
  ]);

  const visits = rows.map((row: any) => {
    const { enrollment, recordedBy, ...rest } = row;
    const { program, mother, child, person, family } = enrollment;

    return {
      ...toVisitRead(rest),
      program,
      subjectName:
        mother?.name ?? child?.name ?? person?.name ?? family?.familyName ?? null,
      recordedByName: [recordedBy?.firstName, recordedBy?.lastName]
        .map(name => name?.trim()).filter(Boolean).join(' ') || null,
    };
  });

  return { visits, total };
}

export async function getVisitById(visitId: number, user: UserRead): Promise<VisitRead> {
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, enrollment: { deletedAt: null } },
    select: VISIT_SELECT,
  });

  if (!visit) {
    throw new HTTPException(404, { message: 'Visit not found' });
  }

  return toVisitRead(visit);
}

/**
 * Record a visit. The spine row plus up to five dependent tables are written by
 * a single nested create, which Prisma runs in one transaction — a visit is
 * never half-recorded.
 */
export async function createVisit(data: VisitCreate, user: UserRead): Promise<VisitRead> {
  const enrollment = await loadEnrollment(data.enrollmentId);

  const detail = assertDetailMatchesKind(enrollment.program.kind as ProgramKind, data);

  assertVisitDateNotBeforeAdmission(data.visitDate, enrollment.enrolledAt);

  if (data.localId) {
    const existing = await prisma.visit.findUnique({
      where: { localId: data.localId },
      select: { id: true },
    });

    if (existing) {
      throw new HTTPException(400, { message: 'Visit with this localId already exists' });
    }
  }

  await assertReferencesExist(data, detail);

  const created = await prisma.visit.create({
    data: {
      enrollmentId: data.enrollmentId,
      visitDate: new Date(data.visitDate),
      locationType: data.locationType,
      siteId: data.siteId,
      communityId: data.communityId,
      eventId: data.eventId,
      notes: data.notes,
      localId: data.localId,
      recordedById: user.id,
      resources: { create: data.resources.map(toResourceRow) },
      trainings: { create: data.trainingIds.map((trainingId) => ({ trainingId })) },
      answers: { create: data.answers.map(toAnswerRow) },
      ...(detail.kind === 'pregnancy' && detail.value
        ? { pregnancyDetail: { create: detail.value } }
        : {}),
      ...(detail.kind === 'nutrition' && detail.value
        ? {
            nutritionDetail: {
              create: withZScores(detail.value, enrollment.child, data.visitDate),
            },
          }
        : {}),
    },
    select: VISIT_SELECT,
  });

  return toVisitRead(created);
}

/**
 * Update a visit.
 *
 * Join-table semantics: an absent `resources` / `trainingIds` / `answers` key
 * leaves those rows alone, a present one replaces them wholesale. Getting this
 * backwards would mean editing a visit's notes silently wiped its resources.
 */
export async function updateVisit(
  visitId: number,
  data: VisitUpdate,
  user: UserRead
): Promise<VisitRead> {
  const existing = await prisma.visit.findFirst({
    where: { id: visitId, enrollment: { deletedAt: null } },
    select: {
      id: true,
      visitDate: true,
      nutritionDetail: {
        select: { weight: true, height: true, armCircumference: true },
      },
      enrollment: {
        select: {
          enrolledAt: true,
          program: { select: { kind: true } },
          child: { select: { birthDate: true, sex: true } },
        },
      },
    },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Visit not found' });
  }

  const detail = assertDetailMatchesKind(
    existing.enrollment.program.kind as ProgramKind,
    data
  );

  const visitDate = data.visitDate ?? toDateOnly(existing.visitDate)!;
  assertVisitDateNotBeforeAdmission(visitDate, existing.enrollment.enrolledAt);

  await assertReferencesExist(data, detail);

  const updateData: any = { updatedAt: new Date() };

  if (data.visitDate !== undefined) updateData.visitDate = new Date(data.visitDate);
  if (data.locationType !== undefined) updateData.locationType = data.locationType;
  if (data.siteId !== undefined) updateData.siteId = data.siteId;
  if (data.communityId !== undefined) updateData.communityId = data.communityId;
  if (data.eventId !== undefined) updateData.eventId = data.eventId;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.resources !== undefined) {
    updateData.resources = { deleteMany: {}, create: data.resources.map(toResourceRow) };
  }

  if (data.trainingIds !== undefined) {
    updateData.trainings = {
      deleteMany: {},
      create: data.trainingIds.map((trainingId) => ({ trainingId })),
    };
  }

  if (data.answers !== undefined) {
    updateData.answers = { deleteMany: {}, create: data.answers.map(toAnswerRow) };
  }

  if (detail.kind === 'pregnancy' && detail.value) {
    updateData.pregnancyDetail = {
      upsert: { create: detail.value, update: detail.value },
    };
  }

  // Moving visitDate changes the child's age, and therefore every z-score. If
  // the caller sent new measurements we recompute from those; if they only moved
  // the date we recompute from the stored ones, or the persisted status silently
  // goes stale.
  const nutritionSource = detail.kind === 'nutrition' ? detail.value : undefined;
  const dateMoved = data.visitDate !== undefined && data.visitDate !== toDateOnly(existing.visitDate);

  if (nutritionSource || (dateMoved && existing.nutritionDetail)) {
    const measurements = nutritionSource ?? {
      weight: toDecimal(existing.nutritionDetail!.weight),
      height: existing.nutritionDetail!.height,
      armCircumference: existing.nutritionDetail!.armCircumference,
    };

    const payload = withZScores(measurements, existing.enrollment.child, visitDate);
    updateData.nutritionDetail = { upsert: { create: payload, update: payload } };
  }

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: updateData,
    select: VISIT_SELECT,
  });

  return toVisitRead(updated);
}

/**
 * Soft delete a visit. Supervisor+ only.
 */
export async function deleteVisit(visitId: number, user: UserRead): Promise<void> {
  const existing = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Visit not found' });
  }

  await prisma.visit.update({
    where: { id: visitId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Defaults for a new visit on this enrollment (WEB_DESIGN_V2.md §7): the previous
 * visit's location, falling back to the subject's home community and its site.
 *
 * The date is not returned — the client's "today" is the honest one, and deriving
 * it from the server would shift the day for anyone far from UTC.
 */
export async function getVisitPrefill(
  enrollmentId: number,
  user: UserRead
): Promise<VisitPrefill> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      mother: { select: { communityId: true } },
      child: { select: { communityId: true } },
      person: { select: { communityId: true } },
      family: { select: { communityId: true } },
      visits: {
        where: { deletedAt: null },
        orderBy: [{ visitDate: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { locationType: true, siteId: true, communityId: true },
      },
    },
  });

  if (!enrollment) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  const previous = enrollment.visits[0];

  if (previous) {
    return {
      locationType: previous.locationType,
      siteId: previous.siteId,
      communityId: previous.communityId,
      source: 'PREVIOUS_VISIT',
    };
  }

  const subject =
    enrollment.mother ?? enrollment.child ?? enrollment.person ?? enrollment.family;
  const communityId = subject?.communityId ?? null;

  if (communityId === null) {
    return { locationType: 'SITE', siteId: null, communityId: null, source: 'DEFAULT' };
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { siteId: true },
  });

  return {
    locationType: 'SITE',
    siteId: community?.siteId ?? null,
    communityId,
    source: 'SUBJECT_HOME',
  };
}

type DetailBlock =
  | { kind: 'pregnancy'; value?: any }
  | { kind: 'nutrition'; value?: any }
  | { kind: null; value?: undefined };

async function loadEnrollment(enrollmentId: number) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      enrolledAt: true,
      program: { select: { kind: true } },
      child: { select: { birthDate: true, sex: true } },
    },
  });

  if (!enrollment) {
    throw new HTTPException(404, { message: 'Enrollment not found' });
  }

  return enrollment;
}

/**
 * Only PREGNANCY and NUTRITION programs take a visit detail; MIDWIFE, STUDENT and
 * FAMILY_PAF visits are pure spine (SCHEMA_V2.md §6.3).
 */
function assertDetailMatchesKind(
  kind: ProgramKind,
  data: { pregnancyDetail?: any; nutritionDetail?: any }
): DetailBlock {
  const allowed = KIND_VISIT_DETAIL[kind];

  const supplied = (['pregnancy', 'nutrition'] as const).filter(
    (name) => data[`${name}Detail` as const] !== undefined
  );

  const disallowed = supplied.filter((name) => name !== allowed);

  if (disallowed.length > 0) {
    throw new HTTPException(400, {
      message: allowed
        ? `Program kind ${kind} accepts only ${allowed}Detail, got ${disallowed.map((n) => `${n}Detail`).join(', ')}`
        : `Program kind ${kind} accepts no visit detail, got ${disallowed.map((n) => `${n}Detail`).join(', ')}`,
    });
  }

  if (!allowed) return { kind: null };

  return { kind: allowed, value: data[`${allowed}Detail` as const] } as DetailBlock;
}

function assertVisitDateNotBeforeAdmission(visitDate: string, enrolledAt: Date): void {
  if (new Date(visitDate) < enrolledAt) {
    throw new HTTPException(400, {
      message: 'Visit date cannot be earlier than the admission date',
    });
  }
}

/**
 * Every FK the payload names, checked in a handful of batched queries. The join
 * tables have composite primary keys, so a repeated id would surface as an opaque
 * P2002 rather than something a worker can act on.
 */
async function assertReferencesExist(
  data: Partial<VisitCreate>,
  detail: DetailBlock
): Promise<void> {
  const checks: Promise<void>[] = [];

  if (data.siteId) checks.push(assertRowExists('site', data.siteId, 'Site'));
  if (data.communityId) checks.push(assertRowExists('community', data.communityId, 'Community'));
  if (data.eventId) checks.push(assertRowExists('event', data.eventId, 'Event'));

  if (detail.kind === 'pregnancy' && detail.value?.examinationTypeId) {
    checks.push(
      assertRowExists('examinationType', detail.value.examinationTypeId, 'Examination type')
    );
  }

  if (data.resources !== undefined) {
    const ids = data.resources.map((entry) => entry.resourceId);
    assertNoDuplicates(ids, 'resource');
    checks.push(assertRowsExist('resource', ids, 'Resource'));
  }

  if (data.trainingIds !== undefined) {
    assertNoDuplicates(data.trainingIds, 'training');
    checks.push(assertRowsExist('training', data.trainingIds, 'Training'));
  }

  if (data.answers !== undefined) {
    const ids = data.answers.map((entry) => entry.questionId);
    assertNoDuplicates(ids, 'question');
    checks.push(assertRowsExist('question', ids, 'Question'));
  }

  await Promise.all(checks);
}

function assertNoDuplicates(ids: number[], label: string): void {
  const seen = new Set<number>();
  const duplicate = ids.find((id) => (seen.has(id) ? true : (seen.add(id), false)));

  if (duplicate !== undefined) {
    throw new HTTPException(400, {
      message: `Duplicate ${label} id ${duplicate} — each ${label} may appear only once on a visit`,
    });
  }
}

async function assertRowExists(model: string, id: number, label: string): Promise<void> {
  const row = await (prisma as any)[model].findFirst({
    where: { id },
    select: { id: true },
  });

  if (!row) {
    throw new HTTPException(404, { message: `${label} not found` });
  }
}

async function assertRowsExist(model: string, ids: number[], label: string): Promise<void> {
  if (ids.length === 0) return;

  const rows = await (prisma as any)[model].findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  if (rows.length !== ids.length) {
    const found = new Set(rows.map((row: any) => row.id));
    const missing = ids.filter((id) => !found.has(id));

    throw new HTTPException(404, {
      message: `${label} not found: ${missing.join(', ')}`,
    });
  }
}

function toResourceRow(entry: { resourceId: number; quantity: number; unit?: string | null }) {
  return { resourceId: entry.resourceId, quantity: entry.quantity, unit: entry.unit ?? null };
}

function toAnswerRow(entry: {
  questionId: number;
  valueText?: string | null;
  valueNum?: number | null;
  valueBool?: boolean | null;
}) {
  return {
    questionId: entry.questionId,
    valueText: entry.valueText ?? null,
    valueNum: entry.valueNum ?? null,
    valueBool: entry.valueBool ?? null,
  };
}

/**
 * Attach the four z-scores and the derived status to a set of measurements.
 * SCHEMA_V2.md §6.3 persists these at write time so reports index the enum
 * rather than recalculating WHO tables on every read.
 */
function withZScores(
  measurements: { weight?: number | null; height?: number | null; armCircumference?: number | null },
  child: { birthDate: Date; sex: Sex } | null | undefined,
  visitDate: string
): Record<string, unknown> {
  const scores: NutritionZScores = child
    ? computeNutritionZScores(
        {
          weightKg: measurements.weight,
          heightMm: measurements.height,
          armCircumferenceMm: measurements.armCircumference,
        },
        ageInDays(child.birthDate, new Date(visitDate)),
        child.sex
      )
    : {
        weightForAgeZ: null,
        heightForAgeZ: null,
        weightForHeightZ: null,
        muacZ: null,
        nutritionalStatus: null,
      };

  return {
    weight: measurements.weight ?? null,
    height: measurements.height ?? null,
    armCircumference: measurements.armCircumference ?? null,
    ...scores,
  };
}
