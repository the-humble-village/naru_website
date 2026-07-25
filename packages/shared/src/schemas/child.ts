import { z } from 'zod';

// Sex enum validation
export const SexEnum = z.enum(['MALE', 'FEMALE']);

// Child creation schema (for creating new children)
export const ChildCreateSchema = z.object({
  familyId: z.number().int().positive(),
  name: z.string().max(256),
  birthDate: z.string().datetime(),
  sex: SexEnum,
  dateEntered: z.string().datetime().optional().nullable(),
  photos: z.array(z.number().int().positive()).default([]),
  weight: z.number().min(0).default(0), // kilograms
  nutritionalState: z.string().max(512).optional().nullable(),
  reasonEnrollment: z.string().max(4096).optional().nullable(),
  observations: z.string().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Child update schema (partial fields for updates)
export const ChildUpdateSchema = ChildCreateSchema.partial();

// Child read schema (what's returned from API - never includes deletedAt)
export const ChildReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyId: z.number().int().positive(),
  name: z.string(),
  birthDate: z.string().datetime(),
  sex: SexEnum,
  dateEntered: z.string().datetime().nullable(),
  photos: z.array(z.number().int().positive()),
  weight: z.number(),
  nutritionalState: z.string().nullable(),
  reasonEnrollment: z.string().nullable(),
  observations: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type Sex = z.infer<typeof SexEnum>;
export type ChildCreate = z.infer<typeof ChildCreateSchema>;
export type ChildUpdate = z.infer<typeof ChildUpdateSchema>;
export type ChildRead = z.infer<typeof ChildReadSchema>;