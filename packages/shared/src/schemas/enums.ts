import { z } from 'zod';

export const SexEnum = z.enum(['MALE', 'FEMALE']);

export const ProgramKindEnum = z.enum([
  'PREGNANCY',
  'NUTRITION',
  'MIDWIFE',
  'STUDENT',
  'FAMILY_PAF',
]);

export const SubjectTypeEnum = z.enum(['MOTHER', 'CHILD', 'PERSON', 'FAMILY']);

export const ExitReasonEnum = z.enum([
  'GRADUATED',
  'WITHDREW',
  'MOVED_AWAY',
  'DIED',
  'TRANSFERRED',
  'AGED_OUT',
  'LOST',
]);

export const LocationTypeEnum = z.enum(['SITE', 'HOME', 'MOBILE_CLINIC']);

export const NutritionalStatusEnum = z.enum(['SEVERE', 'MODERATE', 'MILD', 'NORMAL']);

export const AnswerTypeEnum = z.enum(['TEXT', 'NUMBER', 'BOOL', 'CHOICE']);

export const PhotoOwnerTypeEnum = z.enum([
  'VISIT',
  'CHILD',
  'MOTHER',
  'PERSON',
  'FAMILY',
  'EVENT',
]);

// Which subject FK a program's enrollments populate. Mirrors the CHECK
// constraint in the migration — the service layer validates against this before
// Postgres has a chance to reject the row.
export const SUBJECT_FK: Record<z.infer<typeof SubjectTypeEnum>, 'motherId' | 'childId' | 'personId' | 'familyId'> = {
  MOTHER: 'motherId',
  CHILD: 'childId',
  PERSON: 'personId',
  FAMILY: 'familyId',
};

// Which detail table a program kind permits. MIDWIFE and FAMILY_PAF carry none.
export const KIND_ENROLLMENT_DETAIL: Record<z.infer<typeof ProgramKindEnum>, 'pregnancy' | 'nutrition' | 'student' | null> = {
  PREGNANCY: 'pregnancy',
  NUTRITION: 'nutrition',
  STUDENT: 'student',
  MIDWIFE: null,
  FAMILY_PAF: null,
};

export const KIND_VISIT_DETAIL: Record<z.infer<typeof ProgramKindEnum>, 'pregnancy' | 'nutrition' | null> = {
  PREGNANCY: 'pregnancy',
  NUTRITION: 'nutrition',
  STUDENT: null,
  MIDWIFE: null,
  FAMILY_PAF: null,
};

// Date-only columns (@db.Date). Accepts a bare YYYY-MM-DD or a full ISO
// timestamp and normalises to YYYY-MM-DD, so a client in a behind-UTC timezone
// cannot shift an admission or visit onto the previous day.
export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, 'Expected YYYY-MM-DD')
  .transform((value) => value.slice(0, 10));

export type Sex = z.infer<typeof SexEnum>;
export type ProgramKind = z.infer<typeof ProgramKindEnum>;
export type SubjectType = z.infer<typeof SubjectTypeEnum>;
export type ExitReason = z.infer<typeof ExitReasonEnum>;
export type LocationType = z.infer<typeof LocationTypeEnum>;
export type NutritionalStatus = z.infer<typeof NutritionalStatusEnum>;
export type AnswerType = z.infer<typeof AnswerTypeEnum>;
export type PhotoOwnerType = z.infer<typeof PhotoOwnerTypeEnum>;
