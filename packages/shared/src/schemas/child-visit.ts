import { z } from 'zod';

// Schema for question objects in the questions JSON field
export const ChildVisitQuestionSchema = z.object({
  questionId: z.number().int().positive(),
  question: z.string(),
  answer: z.string(),
});

// Child visit creation schema (for creating new child visits)
export const ChildVisitCreateSchema = z.object({
  familyId: z.number().int().positive(),
  childId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  weight: z.number().int().min(0).default(0), // grams
  armCircumference: z.number().int().min(0).default(0), // millimeters
  height: z.number().int().min(0).default(0), // millimeters
  incap: z.boolean().default(false), // gave special drink
  leche: z.boolean().default(false), // drinking milk
  bagsGiven: z.string().optional().nullable(),
  recvAnyMedicine: z.string().optional().nullable(),
  leftFromProg: z.string().optional().nullable(),
  passedAway: z.string().optional().nullable(),
  questions: z.array(ChildVisitQuestionSchema).default([]), // Array of question objects
  photos: z.array(z.number().int().positive()).default([]),
  notes: z.string().optional().nullable(),
  localId: z.string().uuid().optional(), // Set by client for offline-created records
});

// Child visit update schema (partial fields for updates)
export const ChildVisitUpdateSchema = ChildVisitCreateSchema.partial();

// Child visit read schema (what's returned from API - never includes deletedAt)
export const ChildVisitReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  familyId: z.number().int().positive(),
  childId: z.number().int().positive(),
  visitDate: z.string().datetime(),
  weight: z.number().int(),
  armCircumference: z.number().int(),
  height: z.number().int(),
  incap: z.boolean(),
  leche: z.boolean(),
  bagsGiven: z.string().nullable(),
  recvAnyMedicine: z.string().nullable(),
  leftFromProg: z.string().nullable(),
  passedAway: z.string().nullable(),
  questions: z.array(ChildVisitQuestionSchema),
  photos: z.array(z.number().int().positive()),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Inferred types for TypeScript
export type ChildVisitQuestion = z.infer<typeof ChildVisitQuestionSchema>;
export type ChildVisitCreate = z.infer<typeof ChildVisitCreateSchema>;
export type ChildVisitUpdate = z.infer<typeof ChildVisitUpdateSchema>;
export type ChildVisitRead = z.infer<typeof ChildVisitReadSchema>;