import { z } from 'zod';
import { DateOnlySchema, LocationTypeEnum, NutritionalStatusEnum } from './enums.js';
import { ProgramReadSchema } from './program.js';

export const PregnancyVisitDetailSchema = z.object({
  weight: z.number().min(0).optional().nullable(), // kilograms
  gestationMonths: z.number().int().min(0).max(11).optional().nullable(),
  examinationTypeId: z.number().int().positive().optional().nullable(),
});

// The four z-scores and nutritionalStatus are computed server-side from weight,
// height, armCircumference and the child's birth date, then persisted. Clients
// never send them; they appear on read only.
export const NutritionVisitDetailSchema = z.object({
  weight: z.number().min(0).optional().nullable(), // kilograms
  height: z.number().int().min(0).optional().nullable(), // millimetres
  armCircumference: z.number().int().min(0).optional().nullable(), // millimetres
});

export const NutritionVisitDetailReadSchema = NutritionVisitDetailSchema.extend({
  weightForAgeZ: z.number().nullable(),
  heightForAgeZ: z.number().nullable(),
  weightForHeightZ: z.number().nullable(),
  muacZ: z.number().nullable(),
  nutritionalStatus: NutritionalStatusEnum.nullable(),
});

export const VisitResourceSchema = z.object({
  resourceId: z.number().int().positive(),
  quantity: z.number().min(0),
  unit: z.string().max(32).optional().nullable(),
});

export const VisitAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  valueText: z.string().optional().nullable(),
  valueNum: z.number().optional().nullable(),
  valueBool: z.boolean().optional().nullable(),
});

export const VisitCreateSchema = z.object({
  enrollmentId: z.number().int().positive(),
  visitDate: DateOnlySchema,
  locationType: LocationTypeEnum,
  siteId: z.number().int().positive().optional().nullable(),
  communityId: z.number().int().positive().optional().nullable(),
  eventId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(),
  resources: z.array(VisitResourceSchema).default([]),
  trainingIds: z.array(z.number().int().positive()).default([]),
  answers: z.array(VisitAnswerSchema).default([]),
  pregnancyDetail: PregnancyVisitDetailSchema.optional(),
  nutritionDetail: NutritionVisitDetailSchema.optional(),
});

// enrollmentId is omitted: a visit cannot be moved to another enrollment.
export const VisitUpdateSchema = VisitCreateSchema.omit({ enrollmentId: true, localId: true }).partial();

export const VisitReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  enrollmentId: z.number().int().positive(),
  visitDate: DateOnlySchema,
  locationType: LocationTypeEnum,
  siteId: z.number().int().nullable(),
  communityId: z.number().int().nullable(),
  recordedById: z.number().int().nullable(),
  eventId: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resources: z.array(VisitResourceSchema),
  trainingIds: z.array(z.number().int().positive()),
  answers: z.array(VisitAnswerSchema),
  pregnancyDetail: PregnancyVisitDetailSchema.nullable().optional(),
  nutritionDetail: NutritionVisitDetailReadSchema.nullable().optional(),
});

export const VisitListItemSchema = VisitReadSchema.extend({
  program: ProgramReadSchema.pick({ id: true, name: true, kind: true, subjectType: true }),
  subjectName: z.string().nullable(),
  recordedByName: z.string().nullable(),
});

// Defaults for a new visit on an enrollment (WEB_DESIGN_V2.md §7). Trainings and
// resources are deliberately absent — they are per-visit facts and must never
// carry over. `source` lets the form tell the worker where the default came from.
export const VisitPrefillSchema = z.object({
  locationType: LocationTypeEnum,
  siteId: z.number().int().nullable(),
  communityId: z.number().int().nullable(),
  source: z.enum(['PREVIOUS_VISIT', 'SUBJECT_HOME', 'DEFAULT']),
});

export type PregnancyVisitDetail = z.infer<typeof PregnancyVisitDetailSchema>;
export type NutritionVisitDetail = z.infer<typeof NutritionVisitDetailSchema>;
export type NutritionVisitDetailRead = z.infer<typeof NutritionVisitDetailReadSchema>;
export type VisitResourceEntry = z.infer<typeof VisitResourceSchema>;
export type VisitAnswerEntry = z.infer<typeof VisitAnswerSchema>;
export type VisitCreate = z.infer<typeof VisitCreateSchema>;
export type VisitUpdate = z.infer<typeof VisitUpdateSchema>;
export type VisitRead = z.infer<typeof VisitReadSchema>;
export type VisitListItem = z.infer<typeof VisitListItemSchema>;
export type VisitPrefill = z.infer<typeof VisitPrefillSchema>;
