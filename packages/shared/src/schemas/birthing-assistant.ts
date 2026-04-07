import { z } from 'zod';

// Birthing assistant creation schema
export const BirthingAssistantCreateSchema = z.object({
  name: z.string().max(128).min(1),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
  // Community and training associations will be handled separately
  communityIds: z.array(z.number().int().positive()).default([]),
  trainingIds: z.array(z.number().int().positive()).default([]),
});

// Birthing assistant update schema (partial fields for updates)
export const BirthingAssistantUpdateSchema = BirthingAssistantCreateSchema.partial();

// Birthing assistant read schema (what's returned from API - never includes deletedAt)
export const BirthingAssistantReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Populated relations
  servedCommunities: z.array(z.object({
    id: z.number().int().positive(),
    title: z.string(),
  })).optional(),
  trainingsReceived: z.array(z.object({
    id: z.number().int().positive(),
    title: z.string(),
  })).optional(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type BirthingAssistantCreate = z.infer<typeof BirthingAssistantCreateSchema>;
export type BirthingAssistantUpdate = z.infer<typeof BirthingAssistantUpdateSchema>;
export type BirthingAssistantRead = z.infer<typeof BirthingAssistantReadSchema>;