import { z } from 'zod';
import { TrainingReceivedSchema, ResourceReceivedSchema } from './family-visit.js';

// Schema for question objects in the questions JSON field
export const ParentVisitQuestionSchema = z.object({
  questionId: z.number().int().positive(),
  question: z.string(),
  answer: z.string(),
});

// Parent visit creation schema (for creating new parent visits)
export const ParentVisitCreateSchema = z.object({
  familyId: z.number().int().positive(),
  parentId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  weight: z.number().min(0).default(0), // kilograms
  trainingsReceived: z.array(TrainingReceivedSchema).default([]),
  resourcesReceived: z.array(ResourceReceivedSchema).default([]),
  questions: z.array(ParentVisitQuestionSchema).default([]),
  photos: z.array(z.number().int().positive()).default([]),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Parent visit update schema (partial fields for updates).
//
// Derived from the create schema so it stays exhaustive: every mutable ParentVisit column
// is updatable, including weight and the inline `trainingsReceived`, `resourcesReceived`,
// `questions` answer and `photos` arrays. `.partial()` wraps each field in ZodOptional
// *around* its ZodDefault, so an omitted field parses to `undefined` rather than to its
// default — a partial update never silently resets untouched columns. Routes omit
// familyId/parentId; a visit cannot be reparented.
export const ParentVisitUpdateSchema = ParentVisitCreateSchema.partial();

// Parent visit read schema (what's returned from API - never includes deletedAt)
export const ParentVisitReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyId: z.number().int().positive(),
  parentId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  weight: z.number(),
  trainingsReceived: z.array(TrainingReceivedSchema),
  resourcesReceived: z.array(ResourceReceivedSchema),
  questions: z.array(ParentVisitQuestionSchema),
  photos: z.array(z.number().int().positive()),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type ParentVisitQuestion = z.infer<typeof ParentVisitQuestionSchema>;
export type ParentVisitCreate = z.infer<typeof ParentVisitCreateSchema>;
export type ParentVisitUpdate = z.infer<typeof ParentVisitUpdateSchema>;
export type ParentVisitRead = z.infer<typeof ParentVisitReadSchema>;
