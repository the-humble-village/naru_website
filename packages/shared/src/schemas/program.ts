import { z } from 'zod';
import { ProgramKindEnum, SubjectTypeEnum } from './enums.js';

export const ProgramCreateSchema = z.object({
  name: z.string().min(1).max(256),
  kind: ProgramKindEnum,
  subjectType: SubjectTypeEnum,
  description: z.string().optional().nullable(),
  minAgeMonths: z.number().int().min(0).optional().nullable(),
  maxAgeMonths: z.number().int().min(0).optional().nullable(),
  visitIntervalDays: z.number().int().min(1).optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// kind and subjectType are locked after creation: changing either would leave
// existing enrollments pointing at the wrong subject FK and detail table.
export const ProgramUpdateSchema = ProgramCreateSchema.omit({
  kind: true,
  subjectType: true,
}).partial();

export const ProgramReadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  kind: ProgramKindEnum,
  subjectType: SubjectTypeEnum,
  description: z.string().nullable(),
  minAgeMonths: z.number().int().nullable(),
  maxAgeMonths: z.number().int().nullable(),
  visitIntervalDays: z.number().int().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProgramCreate = z.infer<typeof ProgramCreateSchema>;
export type ProgramUpdate = z.infer<typeof ProgramUpdateSchema>;
export type ProgramRead = z.infer<typeof ProgramReadSchema>;
