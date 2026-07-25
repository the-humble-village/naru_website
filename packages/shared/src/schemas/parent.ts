import { z } from 'zod';

// Parent creation schema (for creating new parents)
export const ParentCreateSchema = z.object({
  familyId: z.number().int().positive(),
  name: z.string().max(256).optional().nullable(),
  role: z.string().max(64).optional().nullable(), // "mother", "caregiver", etc.
  birthDate: z.string().datetime().optional().nullable(),
  dateEntered: z.string().datetime().optional().nullable(),
  photos: z.array(z.number().int().positive()).default([]),
  reasonEnroll: z.string().max(4096).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Parent update schema (partial fields for updates)
export const ParentUpdateSchema = ParentCreateSchema.partial();

// Parent read schema (what's returned from API - never includes deletedAt)
export const ParentReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyId: z.number().int().positive(),
  name: z.string().nullable(),
  role: z.string().nullable(),
  birthDate: z.string().datetime().nullable(),
  dateEntered: z.string().datetime().nullable(),
  photos: z.array(z.number().int().positive()),
  reasonEnroll: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type ParentCreate = z.infer<typeof ParentCreateSchema>;
export type ParentUpdate = z.infer<typeof ParentUpdateSchema>;
export type ParentRead = z.infer<typeof ParentReadSchema>;