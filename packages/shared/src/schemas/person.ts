import { z } from 'zod';
import { SexEnum } from './enums.js';

export const PersonCreateSchema = z.object({
  name: z.string().min(1).max(256),
  birthDate: z.string().datetime().optional().nullable(),
  sex: SexEnum.optional().nullable(),
  communityId: z.number().int().positive().optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(),
});

export const PersonUpdateSchema = PersonCreateSchema.partial();

export const PersonReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  name: z.string(),
  birthDate: z.string().datetime().nullable(),
  sex: SexEnum.nullable(),
  communityId: z.number().int().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PersonCreate = z.infer<typeof PersonCreateSchema>;
export type PersonUpdate = z.infer<typeof PersonUpdateSchema>;
export type PersonRead = z.infer<typeof PersonReadSchema>;
