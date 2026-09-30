import { z } from 'zod';
import { DateOnlySchema } from './enums.js';

export const FamilyCreateSchema = z.object({
  familyName: z.string().max(512).optional().nullable(),
  communityId: z.number().int().positive().optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  caretaker2Name: z.string().max(256).optional().nullable(),
  incomeSources: z.string().optional().nullable(),
  deathsNotes: z.string().optional().nullable(),
  inCrisis: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(),
});

export const FamilyUpdateSchema = FamilyCreateSchema.partial();

export const FamilyReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyName: z.string().nullable(),
  communityId: z.number().int().nullable(),
  phone: z.string().nullable(),
  caretaker2Name: z.string().nullable(),
  incomeSources: z.string().nullable(),
  deathsNotes: z.string().nullable(),
  inCrisis: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// List rows carry the date of the most recent visit against any of the family's
// enrollments, so the families table can show "Last Visited" without a request
// per row.
export const FamilyListItemSchema = FamilyReadSchema.extend({
  siteId: z.number().int().nullable(),
  lastVisitDate: DateOnlySchema.nullable(),
});

export type FamilyCreate = z.infer<typeof FamilyCreateSchema>;
export type FamilyUpdate = z.infer<typeof FamilyUpdateSchema>;
export type FamilyRead = z.infer<typeof FamilyReadSchema>;
export type FamilyListItem = z.infer<typeof FamilyListItemSchema>;
