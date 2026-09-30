import { z } from 'zod';
import { DateOnlySchema, ExitReasonEnum, NutritionalStatusEnum } from './enums.js';
import { ProgramReadSchema } from './program.js';

export const PregnancyEnrollmentDetailSchema = z.object({
  dueDate: DateOnlySchema.optional().nullable(),
  pregnancyNumber: z.number().int().min(1).optional().nullable(),
  birthingAssistantId: z.number().int().positive().optional().nullable(),
});

export const NutritionEnrollmentDetailSchema = z.object({
  lengthAtAdmission: z.number().int().min(0).optional().nullable(), // millimetres
  caretakerName: z.string().max(256).optional().nullable(),
  caretakerPhone: z.string().max(64).optional().nullable(),
  nutritionalStatus: NutritionalStatusEnum.optional().nullable(),
});

export const StudentEnrollmentDetailSchema = z.object({
  school: z.string().max(256).optional().nullable(),
  classYear: z.string().max(64).optional().nullable(),
});

const EnrollmentSubjectSchema = z.object({
  motherId: z.number().int().positive().optional().nullable(),
  childId: z.number().int().positive().optional().nullable(),
  personId: z.number().int().positive().optional().nullable(),
  familyId: z.number().int().positive().optional().nullable(),
});

const EnrollmentAdmissionSchema = z.object({
  enrolledAt: DateOnlySchema,
  entryWeight: z.number().min(0).optional().nullable(), // kilograms
  entryPhotoId: z.number().int().positive().optional().nullable(),
  admissionNotes: z.string().optional().nullable(),
});

// Mirrors the enrollment_exactly_one_subject CHECK constraint so the API rejects
// the row with a field-level message instead of a Postgres error.
function exactlyOneSubject(
  value: z.infer<typeof EnrollmentSubjectSchema>,
  ctx: z.RefinementCtx
): void {
  const populated = (['motherId', 'childId', 'personId', 'familyId'] as const).filter(
    (key) => value[key] !== undefined && value[key] !== null
  );

  if (populated.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Exactly one of motherId, childId, personId, familyId is required (got ${populated.length})`,
      path: ['motherId'],
    });
  }
}

export const EnrollmentCreateSchema = EnrollmentSubjectSchema.merge(EnrollmentAdmissionSchema)
  .extend({
    programId: z.number().int().positive(),
    localId: z.string().uuid().optional(),
    pregnancyDetail: PregnancyEnrollmentDetailSchema.optional(),
    nutritionDetail: NutritionEnrollmentDetailSchema.optional(),
    studentDetail: StudentEnrollmentDetailSchema.optional(),
  })
  .superRefine(exactlyOneSubject);

// The subject and the program are immutable: moving an enrollment between
// subjects would silently rewrite history. Exit goes through EnrollmentExitSchema.
export const EnrollmentUpdateSchema = EnrollmentAdmissionSchema.partial().extend({
  pregnancyDetail: PregnancyEnrollmentDetailSchema.optional(),
  nutritionDetail: NutritionEnrollmentDetailSchema.optional(),
  studentDetail: StudentEnrollmentDetailSchema.optional(),
});

// exitedAt and exitReason travel together — the enrollment_exit_consistent
// constraint rejects one without the other.
export const EnrollmentExitSchema = z.object({
  exitedAt: DateOnlySchema,
  exitReason: ExitReasonEnum,
  exitWeight: z.number().min(0).optional().nullable(),
  exitPhotoId: z.number().int().positive().optional().nullable(),
  exitNotes: z.string().optional().nullable(),
});

export const EnrollmentReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  programId: z.number().int().positive(),
  motherId: z.number().int().nullable(),
  childId: z.number().int().nullable(),
  personId: z.number().int().nullable(),
  familyId: z.number().int().nullable(),
  enrolledAt: DateOnlySchema,
  entryWeight: z.number().nullable(),
  entryPhotoId: z.number().int().nullable(),
  admissionNotes: z.string().nullable(),
  exitedAt: DateOnlySchema.nullable(),
  exitReason: ExitReasonEnum.nullable(),
  exitWeight: z.number().nullable(),
  exitPhotoId: z.number().int().nullable(),
  exitNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pregnancyDetail: PregnancyEnrollmentDetailSchema.nullable().optional(),
  nutritionDetail: NutritionEnrollmentDetailSchema.nullable().optional(),
  studentDetail: StudentEnrollmentDetailSchema.nullable().optional(),
});

export const EnrollmentListItemSchema = EnrollmentReadSchema.extend({
  program: ProgramReadSchema.pick({ id: true, name: true, kind: true, subjectType: true }),
  subjectName: z.string().nullable(),
  visitCount: z.number().int(),
  lastVisitDate: DateOnlySchema.nullable(),
});

export type PregnancyEnrollmentDetail = z.infer<typeof PregnancyEnrollmentDetailSchema>;
export type NutritionEnrollmentDetail = z.infer<typeof NutritionEnrollmentDetailSchema>;
export type StudentEnrollmentDetail = z.infer<typeof StudentEnrollmentDetailSchema>;
export type EnrollmentCreate = z.infer<typeof EnrollmentCreateSchema>;
export type EnrollmentUpdate = z.infer<typeof EnrollmentUpdateSchema>;
export type EnrollmentExit = z.infer<typeof EnrollmentExitSchema>;
export type EnrollmentRead = z.infer<typeof EnrollmentReadSchema>;
export type EnrollmentListItem = z.infer<typeof EnrollmentListItemSchema>;
