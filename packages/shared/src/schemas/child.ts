import { z } from 'zod';
import { SexEnum } from './enums.js';

// familyId and motherId are optional on purpose: a malnourished infant must be
// admittable with neither. Nothing may block admission.
export const ChildCreateSchema = z.object({
  name: z.string().min(1).max(256),
  birthDate: z.string().datetime(),
  sex: SexEnum,
  communityId: z.number().int().positive().optional().nullable(),
  motherId: z.number().int().positive().optional().nullable(),
  familyId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(),
});

export const ChildUpdateSchema = ChildCreateSchema.partial();

export const ChildReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  name: z.string(),
  birthDate: z.string().datetime(),
  sex: SexEnum,
  communityId: z.number().int().nullable(),
  motherId: z.number().int().nullable(),
  familyId: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChildCreate = z.infer<typeof ChildCreateSchema>;
export type ChildUpdate = z.infer<typeof ChildUpdateSchema>;
export type ChildRead = z.infer<typeof ChildReadSchema>;
