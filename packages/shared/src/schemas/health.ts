import { z } from 'zod';

/**
 * Schema for z-score computation request
 */
export const ZScoreRequestSchema = z.object({
  // Weight in grams (matches child.weight field in schema)
  weight: z.number().int().positive(),
  // Arm circumference in millimeters (matches child_visits.arm_circumference)
  armCircumference: z.number().int().positive().optional(),
  // Birth date as ISO string
  birthDate: z.string().datetime(),
  // Sex as enum value
  sex: z.enum(['MALE', 'FEMALE']),
  // Optional reference date (defaults to current date if not provided)
  referenceDate: z.string().datetime().optional(),
});

/**
 * Schema for individual z-score result
 */
export const ZScoreResultSchema = z.object({
  value: z.number().nullable(),
  classification: z.enum(['severe', 'moderate', 'mild', 'normal', 'above', 'high']).nullable(),
});

/**
 * Schema for z-score computation response
 */
export const ZScoreResponseSchema = z.object({
  ageInDays: z.number().nullable(),
  weightForAge: ZScoreResultSchema,
  armCircumferenceForAge: ZScoreResultSchema,
});

// Inferred types
export type ZScoreRequest = z.infer<typeof ZScoreRequestSchema>;
export type ZScoreResult = z.infer<typeof ZScoreResultSchema>;
export type ZScoreResponse = z.infer<typeof ZScoreResponseSchema>;