import { z } from 'zod';

export const MotherCreateSchema = z.object({
  name: z.string().min(1).max(256),
  birthDate: z.string().datetime().optional().nullable(),
  communityId: z.number().int().positive().optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  familyId: z.number().int().positive().optional().nullable(),
  midwifeId: z.number().int().positive().optional().nullable(),
  pregnancies: z.number().int().min(0).optional().nullable(),
  childrenCount: z.number().int().min(0).optional().nullable(),
  breastfedCount: z.number().int().min(0).optional().nullable(),
  malnutritionDeaths: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(),
});

export const MotherUpdateSchema = MotherCreateSchema.partial();

export const MotherReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  name: z.string(),
  birthDate: z.string().datetime().nullable(),
  communityId: z.number().int().nullable(),
  phone: z.string().nullable(),
  familyId: z.number().int().nullable(),
  midwifeId: z.number().int().nullable(),
  pregnancies: z.number().int().nullable(),
  childrenCount: z.number().int().nullable(),
  breastfedCount: z.number().int().nullable(),
  malnutritionDeaths: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MotherCreate = z.infer<typeof MotherCreateSchema>;
export type MotherUpdate = z.infer<typeof MotherUpdateSchema>;
export type MotherRead = z.infer<typeof MotherReadSchema>;
