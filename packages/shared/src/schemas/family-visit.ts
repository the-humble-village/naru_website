import { z } from 'zod';

// Schema for training objects in the trainingsReceived JSON field
export const TrainingReceivedSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
});

// Schema for resource objects in the resourcesReceived JSON field
export const ResourceReceivedSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
});

// Schema for question objects in the questions JSON field
export const FamilyVisitQuestionSchema = z.object({
  questionId: z.number().int().positive(),
  question: z.string(),
  answer: z.string(),
});

// Family visit creation schema (for creating new family visits)
export const FamilyVisitCreateSchema = z.object({
  familyId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  trainingsReceived: z.array(TrainingReceivedSchema).default([]), // Array of training objects
  resourcesReceived: z.array(ResourceReceivedSchema).default([]), // Array of resource objects
  questions: z.array(FamilyVisitQuestionSchema).default([]), // Array of question objects
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Family visit update schema (partial fields for updates)
export const FamilyVisitUpdateSchema = FamilyVisitCreateSchema.partial();

// Family visit read schema (what's returned from API - never includes deletedAt)
export const FamilyVisitReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  trainingsReceived: z.array(TrainingReceivedSchema),
  resourcesReceived: z.array(ResourceReceivedSchema),
  questions: z.array(FamilyVisitQuestionSchema),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type TrainingReceived = z.infer<typeof TrainingReceivedSchema>;
export type ResourceReceived = z.infer<typeof ResourceReceivedSchema>;
export type FamilyVisitQuestion = z.infer<typeof FamilyVisitQuestionSchema>;
export type FamilyVisitCreate = z.infer<typeof FamilyVisitCreateSchema>;
export type FamilyVisitUpdate = z.infer<typeof FamilyVisitUpdateSchema>;
export type FamilyVisitRead = z.infer<typeof FamilyVisitReadSchema>;