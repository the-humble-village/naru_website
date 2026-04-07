import { z } from 'zod';

// Family creation schema (for creating new families)
export const FamilyCreateSchema = z.object({
  familyName: z.string().max(512).optional().nullable(),
  childrenEditable: z.number().int().min(0).default(0),
  inCrisis: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  communityId: z.number().int().positive().optional().nullable(),
  siteId: z.number().int().positive().optional().nullable(),
  birthingAssistantId: z.number().int().positive().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Family update schema (partial fields for updates)
export const FamilyUpdateSchema = FamilyCreateSchema.partial();

// Family read schema (what's returned from API - never includes deletedAt)
export const FamilyReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyName: z.string().nullable(),
  childrenEditable: z.number().int(),
  inCrisis: z.boolean(),
  notes: z.string().nullable(),
  communityId: z.number().int().nullable(),
  siteId: z.number().int().nullable(),
  birthingAssistantId: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type FamilyCreate = z.infer<typeof FamilyCreateSchema>;
export type FamilyUpdate = z.infer<typeof FamilyUpdateSchema>;
export type FamilyRead = z.infer<typeof FamilyReadSchema>;